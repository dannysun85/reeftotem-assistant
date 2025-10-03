import { Live2DManager } from "@/lib/live2d/Live2DManager";
import { useSentioLive2DStore } from "@/lib/store/sentio";
import { ResourceModel } from "@/lib/protocol";

export const useLive2D = () => {
    const { ready, setReady } = useSentioLive2DStore();

    const checkLive2DReady = () => {
        if (Live2DManager.getInstance().isReady()) {
            setReady(true);
        } else {
            setTimeout(checkLive2DReady, 1000);
        }
    }

    const setLive2dCharacter = (character: ResourceModel| null) => {
        Live2DManager.getInstance().changeCharacter(character);
        if (character != null) {
            setReady(false);
            checkLive2DReady();
        }

    };

    return {
        setLive2dCharacter,
        ready,
    };
}