import { useRef, useState } from 'react';
import { Button, Popup, Toast } from 'antd-mobile';

interface ShareReportCardProps {
  visible: boolean;
  onClose: () => void;
  petName: string;
  distance: string;
  duration: string;
  weather?: string;
  photoUrl?: string;
}

export function ShareReportCard({ visible, onClose, petName, distance, duration, weather, photoUrl }: ShareReportCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);

  function drawRest(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#3D3D3D';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${petName}的遛狗日记`, 375, 720);

    ctx.fillStyle = '#8DB3C4';
    ctx.font = '30px sans-serif';
    const detail = `今天遛了 ${distance} · ${duration}${weather ? ` · ${weather}` : ''}`;
    ctx.fillText(detail, 375, 790);

    ctx.fillStyle = '#B5836A';
    ctx.font = '26px sans-serif';
    ctx.fillText('遛遛 · 出门遛个弯的事儿', 375, 1110);

    ctx.fillStyle = '#F5F0EB';
    ctx.fillRect(285, 1160, 180, 120);
    ctx.strokeStyle = '#8DB3C4';
    ctx.lineWidth = 4;
    ctx.strokeRect(285, 1160, 180, 120);
    ctx.fillStyle = '#8C8C8C';
    ctx.font = '22px sans-serif';
    ctx.fillText('保存这次好好遛', 375, 1230);
  }

  function drawPlaceholder(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#F5F0EB';
    ctx.fillRect(40, 40, 670, 600);
    ctx.strokeStyle = '#8DB3C4';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, 670, 600);
    ctx.fillStyle = '#8C8C8C';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('今天遛了', 375, 340);
  }

  function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
    const targetX = 40;
    const targetY = 40;
    const targetWidth = 670;
    const targetHeight = 600;
    const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
    const sourceWidth = targetWidth / scale;
    const sourceHeight = targetHeight / scale;
    const sourceX = (img.naturalWidth - sourceWidth) / 2;
    const sourceY = (img.naturalHeight - sourceHeight) / 2;
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight);
  }

  function drawCanvas(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('no canvas'));
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no context'));
        return;
      }

      canvas.width = 750;
      canvas.height = 1334;
      ctx.fillStyle = '#F4ECD8';
      ctx.fillRect(0, 0, 750, 1334);

      if (!photoUrl) {
        drawPlaceholder(ctx);
        drawRest(ctx);
        resolve(canvas);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        drawImageCover(ctx, img);
        drawRest(ctx);
        resolve(canvas);
      };
      img.onerror = () => {
        drawPlaceholder(ctx);
        drawRest(ctx);
        resolve(canvas);
      };
      img.src = photoUrl;
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      const canvas = await drawCanvas();
      canvas.toBlob((blob) => {
        if (!blob) {
          Toast.show('生成图片失败');
          setSaving(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `遛遛-${petName}的遛狗日记.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setSaving(false);
        Toast.show('图片已生成，按浏览器提示保存');
        onClose();
      }, 'image/png');
    } catch {
      Toast.show('生成图片失败，再试一次');
      setSaving(false);
    }
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} position="bottom" bodyClassName="share-report-sheet">
      <div className="share-report-content">
        <h3>保存遛狗日记</h3>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <p className="share-report-desc">生成一张海报存到手机，想发朋友圈自己发。</p>
        <Button block color="primary" loading={saving} onClick={() => void handleSave()}>
          保存图片
        </Button>
        <button className="share-report-dismiss" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </Popup>
  );
}
