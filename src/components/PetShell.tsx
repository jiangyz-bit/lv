import { Bell } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import donkeyCartPet from "../assets/donkey-cart-pet-clean.png";
import type { PetAlert, StockStatus } from "../domain/types";

interface PetShellProps {
  mood: StockStatus;
  bubble: PetAlert | undefined;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export default function PetShell({ mood, bubble, panelOpen, onTogglePanel }: PetShellProps) {
  function handleHeadPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();

    const start = {
      screenX: event.screenX,
      screenY: event.screenY,
      moved: false
    };

    window.petWindow?.beginDrag?.({ screenX: start.screenX, screenY: start.screenY });

    function handlePointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.screenX - start.screenX;
      const dy = moveEvent.screenY - start.screenY;
      if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
      if (start.moved) {
        window.petWindow?.dragTo?.({ screenX: moveEvent.screenX, screenY: moveEvent.screenY });
      }
    }

    function finishPointer() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
      window.petWindow?.endDrag?.();
      if (!start.moved) onTogglePanel();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPointer, { once: true });
    window.addEventListener("pointercancel", finishPointer, { once: true });
  }

  function handleHeadKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onTogglePanel();
  }

  return (
    <section className={`pet-shell story-pet mood-${mood}`} aria-label="持仓驴车宠物">
      {bubble && !panelOpen ? (
        <div className={`speech-bubble severity-${bubble.severity}`} role="status">
          <Bell size={16} />
          <span>{bubble.summary}</span>
        </div>
      ) : null}

      <div className="pet-body cart-pet-body" aria-label="拖动持仓宠物">
        <span className="cart-motion-stage">
          <img className="cart-pet-image cart-main-layer" src={donkeyCartPet} alt="驴车持仓宠物" />
          <img className="cart-pet-image donkey-head-layer" src={donkeyCartPet} alt="" aria-hidden="true" />
          <img className="cart-pet-image donkey-torso-layer" src={donkeyCartPet} alt="" aria-hidden="true" />
          <img className="cart-pet-image donkey-leg-layer leg-front-near" src={donkeyCartPet} alt="" aria-hidden="true" />
          <img className="cart-pet-image donkey-leg-layer leg-front-far" src={donkeyCartPet} alt="" aria-hidden="true" />
          <img className="cart-pet-image donkey-leg-layer leg-rear-near" src={donkeyCartPet} alt="" aria-hidden="true" />
          <img className="cart-pet-image donkey-leg-layer leg-rear-far" src={donkeyCartPet} alt="" aria-hidden="true" />
          <span className="rolling-wheel front-wheel" aria-hidden="true" />
          <span className="whip-stroke" aria-hidden="true" />
          <span className="motion-dust dust-one" aria-hidden="true" />
          <span className="motion-dust dust-two" aria-hidden="true" />
          <button
            className="donkey-head-hotspot"
            type="button"
            onPointerDown={handleHeadPointerDown}
            onKeyDown={handleHeadKeyDown}
            aria-label="点击驴头查看持仓详情"
            title="点击驴头查看持仓详情"
          />
        </span>
      </div>
    </section>
  );
}
