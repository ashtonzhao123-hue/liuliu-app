import { useState } from 'react';
import { Button, Card, Checkbox, Popup, TextArea, Toast } from 'antd-mobile';
import { CameraOutline } from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { finishWalkerService } from '../../api/walker';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { readOptionalImage } from '../../utils/image';

export function WalkerFinishPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [note, setNote] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [hasPoop, setHasPoop] = useState(false);
  const [hasPee, setHasPee] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function handlePhoto(file?: File) {
    try {
      const image = await readOptionalImage(file);
      if (!image) return;
      setPhotoUrls((items) => [...items, image].slice(0, 3));
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '图片读取失败');
    }
  }

  async function handleSubmit() {
    if (!id || !currentUser || submitting) return;
    if (photoUrls.length < 1) {
      Toast.show('请至少上传一张遛狗照片');
      return;
    }
    setSubmitting(true);
    try {
      await finishWalkerService(id, currentUser.id, {
        note: note.trim() || '服务结束，毛孩子状态不错，已安全归还。',
        photoUrls,
        hasPoop,
        hasPee
      });
      Toast.show('遛狗报告已提交，等待主人确认');
      navigate(`/walker/orders/${id}`, { replace: true });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '结束服务失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer title="结束服务" subtitle="交一张安心的遛狗报告">
      <Card className="summary-card" title="归还前确认">
        <p>确认毛孩子已安全送回，再补充照片和状态记录。主人会在订单详情里看到这份报告。</p>
      </Card>

      <Button block color="primary" size="large" onClick={() => setReportOpen(true)}>
        填写遛狗报告
      </Button>

      <Popup visible={reportOpen} onMaskClick={() => setReportOpen(false)} position="bottom" bodyClassName="walk-report-sheet">
        <div className="sheet-header">
          <div>
            <h3>遛狗报告</h3>
            <p>至少上传 1 张照片，最多 3 张</p>
          </div>
          <Button size="small" fill="none" onClick={() => setReportOpen(false)}>
            稍后
          </Button>
        </div>

        <div className="report-photo-grid">
          {photoUrls.map((photoUrl, index) => (
            <button key={photoUrl} className="report-photo-tile" type="button" onClick={() => setPhotoUrls((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
              <img src={photoUrl} alt={`遛狗照片 ${index + 1}`} />
            </button>
          ))}
          {photoUrls.length < 3 && (
            <label className="report-photo-add">
              <CameraOutline />
              <span>上传照片</span>
              <input hidden type="file" accept="image/*" onChange={(event) => void handlePhoto(event.currentTarget.files?.[0])} />
            </label>
          )}
        </div>

        <div className="report-switch-row">
          <Checkbox checked={hasPoop} onChange={(checked) => setHasPoop(Boolean(checked))}>
            已便便
          </Checkbox>
          <Checkbox checked={hasPee} onChange={(checked) => setHasPee(Boolean(checked))}>
            已尿尿
          </Checkbox>
        </div>

        <TextArea
          rows={5}
          value={note}
          onChange={setNote}
          placeholder="比如：精神很好，走了校园南门一圈，喝水正常。"
          className="report-textarea"
        />

        <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
          提交报告并结束服务
        </Button>
      </Popup>
    </PageContainer>
  );
}
