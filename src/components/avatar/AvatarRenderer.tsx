import { useId } from 'react';
import type { FC } from 'react';
import type { AvatarConfig } from './avatarConfig';
import { generateAvatarSvg } from './generateAvatarSvg';

interface AvatarRendererProps {
  config: AvatarConfig;
  size?: number | string;
  className?: string;
  idPrefix?: string;
}

export const AvatarRenderer: FC<AvatarRendererProps> = ({
  config,
  size = 256,
  className = '',
  idPrefix,
}) => {
  const generatedId = useId().replace(/:/g, '');
  const prefix = idPrefix || generatedId;

  const svgContent = generateAvatarSvg(config, prefix);

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full overflow-hidden select-none inline-flex items-center justify-center shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
