use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use futures_util::future::join_all;
use tauri::{AppHandle, Emitter};

use super::db::WorkflowDb;
use super::types::*;

/// Execute a complete workflow run
pub async fn execute_workflow(
    app: AppHandle,
    db: &WorkflowDb,
    workflow: WorkflowConfig,
    trigger_input: Option<String>,
    cancel: Arc<AtomicBool>,
) -> Result<WorkflowRun, String> {
    // --- Validate ---
    let input_nodes: Vec<_> = workflow.nodes.iter().filter(|n| n.node_type == "input").collect();
    if input_nodes.len() != 1 {
        return Err("工作流必须有且仅有一个输入节点".into());
    }
    let output_nodes: Vec<_> = workflow.nodes.iter().filter(|n| n.node_type == "output").collect();
    if output_nodes.is_empty() {
        return Err("工作流必须至少有一个输出节点".into());
    }
    for n in &workflow.nodes {
        if n.node_type == "agent" && n.data.agent_id.is_none() {
            return Err(format!("智能体节点 '{}' 未选择智能体", n.data.label));
        }
    }

    // --- Topological sort ---
    let layers = topological_sort(&workflow.nodes, &workflow.edges)?;

    // --- Create run record ---
    let run_id = uuid::Uuid::new_v4().to_string();
    let now_ts = chrono::Utc::now().timestamp();
    let mut run = WorkflowRun {
        id: run_id.clone(),
        workflow_id: workflow.id.clone(),
        status: "running".into(),
        trigger_type: "manual".into(),
        trigger_input: trigger_input.clone(),
        started_at: now_ts,
        completed_at: None,
        steps: Vec::new(),
        final_output: None,
        error: None,
    };
    db.create_run(&run)?;

    // Node outputs map
    let outputs: HashMap<String, String> = HashMap::new();
    // Tracks which branches are active (for condition routing)
    let mut branch_active: HashMap<String, bool> = HashMap::new();
    // By default all nodes are active
    for n in &workflow.nodes {
        branch_active.insert(n.id.clone(), true);
    }

    // --- Execute layers (parallel within each layer) ---
    // Shared mutable state for parallel execution
    let outputs = Arc::new(Mutex::new(outputs));
    let branch_active = Arc::new(Mutex::new(branch_active));
    let shared_edges = Arc::new(workflow.edges.clone());

    for layer in &layers {
        // Check cancel before each layer
        if cancel.load(Ordering::Relaxed) {
            run.status = "cancelled".into();
            run.completed_at = Some(chrono::Utc::now().timestamp());
            if let Err(e) = db.update_run(&run) {
                eprintln!("[workflow] Failed to update run in DB: {e}");
            }
            return Ok(run);
        }

        // Separate nodes into parallelizable (agent) and sequential (condition/merge)
        let mut parallel_nodes = Vec::new();
        let mut sequential_nodes = Vec::new();

        for node_id in layer {
            let node = match workflow.nodes.iter().find(|n| &n.id == node_id) {
                Some(n) => n,
                None => continue,
            };
            match node.node_type.as_str() {
                "condition" | "merge" => sequential_nodes.push(node_id.clone()),
                _ => parallel_nodes.push(node_id.clone()),
            }
        }

        // Execute parallelizable nodes concurrently
        if !parallel_nodes.is_empty() {
            let futures: Vec<_> = parallel_nodes.iter().filter_map(|node_id| {
                let node = workflow.nodes.iter().find(|n| &n.id == node_id)?.clone();
                let outputs_ref = Arc::clone(&outputs);
                let branch_active_ref = Arc::clone(&branch_active);
                let app_ref = app.clone();
                let run_id_ref = run_id.clone();
                let edges_ref = Arc::clone(&shared_edges);
                let node_id_ref = node_id.clone();

                Some(async move {
                    // Check if active
                    let ba = branch_active_ref.lock().await;
                    if !is_node_active(&node_id_ref, &edges_ref, &ba) {
                        drop(ba);
                        let mut ba_w = branch_active_ref.lock().await;
                        ba_w.insert(node_id_ref.clone(), false);
                        return Ok::<(String, String, bool), (String, String, i64, Option<String>, String)>((node_id_ref, String::new(), true)); // skipped
                    }
                    let outs = outputs_ref.lock().await;
                    let input_text = gather_input(&node_id_ref, &edges_ref, &outs, &ba);
                    drop(ba);
                    drop(outs);

                    let step_start = chrono::Utc::now().timestamp();
                    let _ = app_ref.emit("workflow_stepProgress", WorkflowStepProgressEvent {
                        run_id: run_id_ref.clone(),
                        node_id: node_id_ref.clone(),
                        status: "running".into(),
                        output: None,
                        error: None,
                    });

                    let result = execute_simple_node(&app_ref, &node, &input_text, &run_id_ref).await;
                    match result {
                        Ok(output) => {
                            let _ = app_ref.emit("workflow_stepProgress", WorkflowStepProgressEvent {
                                run_id: run_id_ref.clone(),
                                node_id: node_id_ref.clone(),
                                status: "completed".into(),
                                output: Some(output.clone()),
                                error: None,
                            });
                            Ok((node_id_ref, output, false))
                        }
                        Err(e) => {
                            let _ = app_ref.emit("workflow_stepProgress", WorkflowStepProgressEvent {
                                run_id: run_id_ref.clone(),
                                node_id: node_id_ref.clone(),
                                status: "failed".into(),
                                output: None,
                                error: Some(e.clone()),
                            });
                            Err((node_id_ref, e, step_start, node.data.agent_id.clone(), input_text))
                        }
                    }
                })
            }).collect();

            let results = join_all(futures).await;

            for result in results {
                match result {
                    Ok((node_id, output, skipped)) => {
                        if !skipped {
                            let node = workflow.nodes.iter().find(|n| n.id == node_id);
                            run.steps.push(StepResult {
                                node_id: node_id.clone(),
                                status: "completed".into(),
                                input: String::new(),
                                output: output.clone(),
                                started_at: chrono::Utc::now().timestamp(),
                                completed_at: Some(chrono::Utc::now().timestamp()),
                                error: None,
                                agent_id: node.and_then(|n| n.data.agent_id.clone()),
                                session_key: None,
                            });
                            outputs.lock().await.insert(node_id, output);
                        }
                    }
                    Err((node_id, err, step_start, agent_id, input_text)) => {
                        run.steps.push(StepResult {
                            node_id: node_id.clone(),
                            status: "failed".into(),
                            input: input_text,
                            output: String::new(),
                            started_at: step_start,
                            completed_at: Some(chrono::Utc::now().timestamp()),
                            error: Some(err.clone()),
                            agent_id,
                            session_key: None,
                        });
                        run.status = "failed".into();
                        run.error = Some(err);
                        run.completed_at = Some(chrono::Utc::now().timestamp());
                        if let Err(e) = db.update_run(&run) {
                eprintln!("[workflow] Failed to update run in DB: {e}");
            }
                        return Ok(run);
                    }
                }
            }
        }

        // Execute sequential nodes (condition/merge) that need mutable branch_active
        for node_id in &sequential_nodes {
            if cancel.load(Ordering::Relaxed) {
                run.status = "cancelled".into();
                run.completed_at = Some(chrono::Utc::now().timestamp());
                if let Err(e) = db.update_run(&run) {
                eprintln!("[workflow] Failed to update run in DB: {e}");
            }
                return Ok(run);
            }

            let node = match workflow.nodes.iter().find(|n| &n.id == node_id) {
                Some(n) => n,
                None => continue,
            };

            let mut ba = branch_active.lock().await;
            if !is_node_active(node_id, &workflow.edges, &ba) {
                ba.insert(node_id.clone(), false);
                continue;
            }

            let outs = outputs.lock().await;
            let input_text = gather_input(node_id, &workflow.edges, &outs, &ba);
            drop(outs);

            let step_start = chrono::Utc::now().timestamp();
            let _ = app.emit("workflow_stepProgress", WorkflowStepProgressEvent {
                run_id: run_id.clone(),
                node_id: node_id.clone(),
                status: "running".into(),
                output: None,
                error: None,
            });

            let result = match node.node_type.as_str() {
                "condition" => execute_condition_node(node, &input_text, &workflow.edges, &mut ba),
                "merge" => {
                    let outs = outputs.lock().await;
                    execute_merge_node(node, &workflow.edges, &outs, &ba)
                }
                _ => Ok(input_text.clone()),
            };
            drop(ba);

            match result {
                Ok(output) => {
                    outputs.lock().await.insert(node_id.clone(), output.clone());
                    run.steps.push(StepResult {
                        node_id: node_id.clone(),
                        status: "completed".into(),
                        input: input_text,
                        output: output.clone(),
                        started_at: step_start,
                        completed_at: Some(chrono::Utc::now().timestamp()),
                        error: None,
                        agent_id: node.data.agent_id.clone(),
                        session_key: None,
                    });
                    let _ = app.emit("workflow_stepProgress", WorkflowStepProgressEvent {
                        run_id: run_id.clone(),
                        node_id: node_id.clone(),
                        status: "completed".into(),
                        output: Some(output),
                        error: None,
                    });
                }
                Err(err) => {
                    run.steps.push(StepResult {
                        node_id: node_id.clone(),
                        status: "failed".into(),
                        input: input_text,
                        output: String::new(),
                        started_at: step_start,
                        completed_at: Some(chrono::Utc::now().timestamp()),
                        error: Some(err.clone()),
                        agent_id: node.data.agent_id.clone(),
                        session_key: None,
                    });
                    run.status = "failed".into();
                    run.error = Some(err);
                    run.completed_at = Some(chrono::Utc::now().timestamp());
                    if let Err(e) = db.update_run(&run) {
                eprintln!("[workflow] Failed to update run in DB: {e}");
            }
                    return Ok(run);
                }
            }
            if let Err(e) = db.update_run(&run) {
                eprintln!("[workflow] Failed to update run in DB: {e}");
            }
        }
    }

    // --- Finalize ---
    // Collect output from output nodes
    let outputs = outputs.lock().await;
    let final_out: Vec<String> = workflow.nodes.iter()
        .filter(|n| n.node_type == "output")
        .filter_map(|n| outputs.get(&n.id))
        .cloned()
        .collect();
    run.final_output = Some(final_out.join("\n\n"));
    run.status = "completed".into();
    run.completed_at = Some(chrono::Utc::now().timestamp());
    if let Err(e) = db.update_run(&run) {
        eprintln!("[workflow] Failed to update final run in DB: {e}");
    }

    Ok(run)
}

/// Check if a node should be executed based on upstream condition routing
fn is_node_active(node_id: &str, edges: &[WorkflowEdge], branch_active: &HashMap<String, bool>) -> bool {
    // Find all edges targeting this node
    let incoming: Vec<_> = edges.iter().filter(|e| e.target == node_id).collect();
    if incoming.is_empty() {
        return true; // Root node (input)
    }
    // Node is active if ANY incoming source is active
    incoming.iter().any(|e| {
        branch_active.get(&e.source).copied().unwrap_or(true)
    })
}

/// Gather input text from all active upstream nodes
fn gather_input(
    node_id: &str,
    edges: &[WorkflowEdge],
    outputs: &HashMap<String, String>,
    branch_active: &HashMap<String, bool>,
) -> String {
    let incoming: Vec<_> = edges.iter().filter(|e| e.target == node_id).collect();
    let parts: Vec<String> = incoming.iter()
        .filter(|e| branch_active.get(&e.source).copied().unwrap_or(true))
        .filter_map(|e| outputs.get(&e.source))
        .cloned()
        .collect();
    parts.join("\n\n")
}

/// Execute a simple node (input/output/agent) that doesn't need mutable branch_active
async fn execute_simple_node(
    app: &AppHandle,
    node: &WorkflowNode,
    input: &str,
    run_id: &str,
) -> Result<String, String> {
    match node.node_type.as_str() {
        "input" | "output" => Ok(input.to_string()),
        "agent" => execute_agent_node(app, node, input, run_id).await,
        _ => Err(format!("未知节点类型: {}", node.node_type)),
    }
}

/// Execute an Agent node: call AI provider
async fn execute_agent_node(
    app: &AppHandle,
    node: &WorkflowNode,
    input: &str,
    run_id: &str,
) -> Result<String, String> {
    let agent_id = node.data.agent_id.as_ref().ok_or("agent node missing agent_id")?;

    // Load settings to find agent and provider
    let settings = crate::settings::load_settings(app)?;
    let agent = settings.agents.iter()
        .find(|a| &a.id == agent_id)
        .ok_or_else(|| format!("未找到智能体: {}", agent_id))?
        .clone();

    let provider_id = agent.provider_id.as_deref()
        .or(settings.default_provider_id.as_deref())
        .ok_or("智能体未配置 Provider，也没有默认 Provider")?;

    let provider = settings.providers.iter()
        .find(|p| p.id == provider_id)
        .ok_or_else(|| format!("未找到 Provider: {}", provider_id))?
        .clone();

    let keys = crate::settings::load_api_keys(app).unwrap_or_default();
    let api_key = keys.get(provider_id).cloned();

    // Build prompt from template
    let prompt = if let Some(ref tpl) = node.data.prompt_template {
        if !tpl.is_empty() {
            tpl.replace("{{input}}", input)
        } else {
            input.to_string()
        }
    } else {
        input.to_string()
    };

    let session_key = format!("wf-{}-{}", run_id, node.id);
    let request = crate::ai::types::AiChatRequest {
        session_key,
        provider_id: provider_id.to_string(),
        messages: vec![crate::ai::types::ChatMessage {
            role: "user".into(),
            content: prompt,
            tool_call_id: None,
            tool_calls: None,
        }],
        system_prompt: if agent.system_prompt.is_empty() { None } else { Some(agent.system_prompt.clone()) },
        model: if agent.model.is_empty() { provider.model.clone() } else { Some(agent.model.clone()) },
        temperature: Some(agent.temperature),
        max_tokens: agent.max_tokens,
        tools: None,
    };

    crate::ai::send_chat_collect(app, &provider, api_key.as_deref(), &request).await
}

/// Execute a Condition node: evaluate rules and mark branches
fn execute_condition_node(
    node: &WorkflowNode,
    input: &str,
    edges: &[WorkflowEdge],
    branch_active: &mut HashMap<String, bool>,
) -> Result<String, String> {
    let rules = node.data.condition_rules.as_ref().cloned().unwrap_or_default();
    let condition_type = node.data.condition_type.as_deref().unwrap_or("keyword");

    // Find outgoing edges from this condition node
    let outgoing: Vec<_> = edges.iter().filter(|e| e.source == node.id).collect();

    // Evaluate which handles match
    let mut matched_handle: Option<String> = None;

    for rule in &rules {
        if rule.is_default {
            continue;
        }
        let matches = match condition_type {
            "keyword" => input.contains(&rule.value),
            "regex" => regex::Regex::new(&rule.value)
                .map(|re| re.is_match(input))
                .unwrap_or(false),
            _ => false,
        };
        if matches {
            matched_handle = Some(rule.handle.clone());
            break;
        }
    }

    // If no match, use default
    if matched_handle.is_none() {
        matched_handle = rules.iter()
            .find(|r| r.is_default)
            .map(|r| r.handle.clone());
    }

    // Mark targets active/inactive based on matched handle
    for edge in &outgoing {
        let edge_handle = edge.source_handle.as_deref().unwrap_or("");
        let is_active = matched_handle.as_deref() == Some(edge_handle);
        branch_active.insert(edge.target.clone(), is_active);
    }

    // Condition passes through the input
    Ok(input.to_string())
}

/// Execute a Merge node: combine outputs from active predecessors
fn execute_merge_node(
    node: &WorkflowNode,
    edges: &[WorkflowEdge],
    outputs: &HashMap<String, String>,
    branch_active: &HashMap<String, bool>,
) -> Result<String, String> {
    let strategy = node.data.merge_strategy.as_deref().unwrap_or("concat");
    let incoming: Vec<_> = edges.iter().filter(|e| e.target == node.id).collect();

    let active_outputs: Vec<String> = incoming.iter()
        .filter(|e| branch_active.get(&e.source).copied().unwrap_or(true))
        .filter_map(|e| outputs.get(&e.source))
        .cloned()
        .collect();

    match strategy {
        "first" => Ok(active_outputs.into_iter().next().unwrap_or_default()),
        "custom" => {
            let tpl = node.data.merge_template.as_deref().unwrap_or("{{branch_0}}");
            let mut result = tpl.to_string();
            for (i, out) in active_outputs.iter().enumerate() {
                result = result.replace(&format!("{{{{branch_{}}}}}", i), out);
            }
            Ok(result)
        }
        _ => Ok(active_outputs.join("\n\n")), // concat
    }
}

/// Kahn's algorithm topological sort returning layers
fn topological_sort(
    nodes: &[WorkflowNode],
    edges: &[WorkflowEdge],
) -> Result<Vec<Vec<String>>, String> {
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();

    for n in nodes {
        in_degree.insert(n.id.clone(), 0);
        adj.insert(n.id.clone(), Vec::new());
    }

    for e in edges {
        if let Some(deg) = in_degree.get_mut(&e.target) {
            *deg += 1;
        }
        if let Some(neighbors) = adj.get_mut(&e.source) {
            neighbors.push(e.target.clone());
        }
    }

    let mut layers: Vec<Vec<String>> = Vec::new();
    let mut queue: Vec<String> = in_degree.iter()
        .filter(|(_, &deg)| deg == 0)
        .map(|(id, _)| id.clone())
        .collect();

    let mut processed = 0;

    while !queue.is_empty() {
        let current_layer = queue.clone();
        queue.clear();

        for node_id in &current_layer {
            processed += 1;
            if let Some(neighbors) = adj.get(node_id) {
                for neighbor in neighbors {
                    if let Some(deg) = in_degree.get_mut(neighbor) {
                        *deg -= 1;
                        if *deg == 0 {
                            queue.push(neighbor.clone());
                        }
                    }
                }
            }
        }

        layers.push(current_layer);
    }

    if processed < nodes.len() {
        return Err("工作流包含循环".into());
    }

    Ok(layers)
}
