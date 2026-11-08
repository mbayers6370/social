"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PORTRAIT_CROP,
  portraitCropBounds,
  type PortraitCrop,
} from "@/lib/portrait-crop";

export function PortraitCropEditor({
  src,
  width,
  height,
  value,
  onChange,
  disabled,
  onReady,
}: {
  src: string;
  width: number;
  height: number;
  value: PortraitCrop;
  onChange: (value: PortraitCrop) => void;
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  const id = useId();
  const [failed, setFailed] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    size: number;
    crop: PortraitCrop;
  } | null>(null);
  const bounds = portraitCropBounds(width, height, value);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return (
    <section
      className="margin-portrait-editor"
      aria-label="Adjust profile photograph"
    >
      <p id={`${id}-hint`} className="margin-field-hint">
        Drag your photograph to frame it, or use the controls below.
      </p>
      <div
        className="margin-portrait-crop"
        aria-describedby={`${id}-hint`}
        onPointerDown={(event) => {
          if (disabled || failed || !event.isPrimary || event.button !== 0)
            return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            size: event.currentTarget.getBoundingClientRect().width,
            crop: value,
          };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId || disabled) return;
          const side = portraitCropBounds(width, height, start.crop).width;
          onChange({
            ...start.crop,
            x:
              width > side
                ? clamp(
                    start.crop.x -
                      ((event.clientX - start.x) * side) /
                        start.size /
                        (width - side),
                  )
                : start.crop.x,
            y:
              height > side
                ? clamp(
                    start.crop.y -
                      ((event.clientY - start.y) * side) /
                        start.size /
                        (height - side),
                  )
                : start.crop.y,
          });
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <Image
          unoptimized
          src={src}
          alt="Profile photograph framing preview"
          width={width}
          height={height}
          draggable={false}
          onLoad={() => {
            setFailed(false);
            onReady(true);
          }}
          onError={() => {
            setFailed(true);
            onReady(false);
          }}
          style={{
            width: `${(width / bounds.width) * 100}%`,
            height: `${(height / bounds.height) * 100}%`,
            left: `${(-bounds.left / bounds.width) * 100}%`,
            top: `${(-bounds.top / bounds.height) * 100}%`,
          }}
        />
      </div>
      {failed && (
        <p role="alert">
          This photograph couldn’t be loaded. Choose another photograph.
        </p>
      )}
      <fieldset
        className="margin-portrait-controls"
        disabled={disabled || failed}
      >
        <legend className="sr-only">Photograph position and zoom</legend>
        {(
          [
            ["zoom", "Zoom", 1, 3, 0.01],
            ["x", "Horizontal position", 0, 1, 0.01],
            ["y", "Vertical position", 0, 1, 0.01],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <label key={key} htmlFor={`${id}-${key}`}>
            <span>{label}</span>
            <input
              id={`${id}-${key}`}
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[key]}
              disabled={
                (key === "x" && width === bounds.width) ||
                (key === "y" && height === bounds.height)
              }
              aria-valuetext={
                key === "zoom"
                  ? `${Math.round(value.zoom * 100)} percent`
                  : `${Math.round(value[key] * 100)} percent`
              }
              onChange={(event) =>
                onChange({ ...value, [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange({ ...DEFAULT_PORTRAIT_CROP })}
        >
          Reset framing
        </Button>
      </fieldset>
    </section>
  );
}
