import { useEffect, useRef } from "react";
import "./CSS/Images.css";

type ImageBlockProps = {
  // The picture as a data: URL; undefined while loading, or when it isn't on this device (yet).
  src?: string;
  // The note's images have loaded and this one isn't among them.
  missing: boolean;
  caption: string;
  onCaption: (caption: string) => void;
  onRemove: () => void;
  // Set right after the image is inserted, to put the cursor in its caption.
  focusFirst: boolean;
  onFocused: () => void;
};

// An image inside a note, like a photo glued onto the card, with its caption written under it. Clicking it (or
// moving into its caption) shows the button that takes it out.
export default function ImageBlock({ src, missing, caption, onCaption, onRemove, focusFirst, onFocused }: ImageBlockProps) {
  const captionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusFirst) return;
    captionRef.current?.focus();
    onFocused();
  }, [focusFirst]);

  return (
    <figure className="figure" tabIndex={0} aria-label={caption ? `Imagem: ${caption}` : "Imagem"}>
      <div className="figure__print">
        {src ? (
          <img className="figure__image" src={src} alt={caption} draggable={false} />
        ) : (
          <p className="figure__missing">
            {missing ? "Esta imagem ainda não está neste aparelho. Ela aparece depois de sincronizar." : "Carregando a imagem…"}
          </p>
        )}
      </div>
      <figcaption>
        <input
          ref={captionRef}
          className="figure__caption"
          value={caption}
          onChange={event => onCaption(event.target.value.replace(/[\]\n]/g, ""))}
          placeholder="Legenda (opcional)"
          aria-label="Legenda da imagem"
          maxLength={200}
          enterKeyHint="done"
        />
      </figcaption>
      <div className="figure__bar">
        <button type="button" className="figure__remove" onMouseDown={event => event.preventDefault()} onClick={onRemove}>
          Remover imagem
        </button>
      </div>
    </figure>
  );
}
