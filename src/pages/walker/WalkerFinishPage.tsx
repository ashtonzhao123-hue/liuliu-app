import { useState } from 'react';
import { Button, Card, Form, TextArea, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { finishWalkerService } from '../../api/walker';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';

export function WalkerFinishPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>();

  async function handleSubmit() {
    if (!id || !currentUser) return;
    try {
      await finishWalkerService(id, currentUser.id, note || '服务结束，已归还狗狗', photoUrl);
      Toast.show('已提交结束服务，等待主人确认');
      navigate(`/walker/orders/${id}`, { replace: true });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '结束失败');
    }
  }

  return (
    <PageContainer title="结束服务" subtitle="上传结束照片并填写归还情况">
      <label className="upload-placeholder">
        {photoUrl ? '已选择结束照片' : '结束照片：拍照上传'}
        <input hidden type="file" accept="image/*" onChange={(event) => void readImage(event.currentTarget.files?.[0]).then(setPhotoUrl)} />
      </label>
      <Form layout="vertical" className="owner-form">
        <Form.Item label="结束备注">
          <TextArea rows={5} value={note} onChange={setNote} />
        </Form.Item>
      </Form>
      <Card className="summary-card" title="服务摘要">
        <p>请确认狗狗已安全归还，并保留结束照片。</p>
      </Card>
      <Button block color="primary" size="large" onClick={handleSubmit}>
        确认结束服务
      </Button>
    </PageContainer>
  );
}

function readImage(file?: File): Promise<string | undefined> {
  if (!file) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
