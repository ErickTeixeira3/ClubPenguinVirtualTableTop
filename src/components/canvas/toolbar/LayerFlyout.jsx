import { LAYER_META } from "../boardConstants.js";
import { useBoardToolsContext } from "../BoardToolsContext.js";
import FlyoutButton from "./FlyoutButton.jsx";

/**
 * Seletor de camadas do Mestre.
 * Trocar de camada não limpa a seleção como efeito colateral na toolbar.
 */
export default function LayerFlyout() {
  const { gmLayer, setGmLayer } = useBoardToolsContext();

  return (
    <div
      className="vtt-tool-flyout"
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {Object.values(LAYER_META).map((layerItem) => (
        <FlyoutButton
          key={layerItem.key}
          active={gmLayer === layerItem.key}
          onClick={() => setGmLayer(layerItem.key)}
        >
          {layerItem.label}
        </FlyoutButton>
      ))}
    </div>
  );
}
