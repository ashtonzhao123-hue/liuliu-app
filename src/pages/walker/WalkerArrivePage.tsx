import { useState } from 'react';
import { Button, Form, TextArea, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { submitArriveCheckpoint } from '../../api/walker';
import { MockMap } from '../../components/MockMap';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';

export function WalkerArrivePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>();

  async function handleSubmit() {
    if (!id || !currentUser) return;
    try {
      await submitArriveCheckpoint(id, currentUser.id, note || '已到达交接点', photoUrl);
      Toast.show('到达打卡已提交');
      navigate(`/walker/orders/${id}/go`, { replace: true });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '提交失败');
    }
  }

  return (
    <PageContainer title="到达打卡" subtitle="到达后才可开始服务">
      <MockMap />
      <label className="upload-placeholder">
        {photoUrl ? '已选择到达照片' : '拍照上传'}
        <input hidden type="file" accept="image/*" onChange={(event) => void readImage(event.currentTarget.files?.[0]).then(setPhotoUrl)} />
      </label>
      <Form layout="vertical" className="owner-form">
        <Form.Item label="备注">
          <TextArea rows={4} value={note} onChange={setNote} placeholder="可填写交接情况" />
        </Form.Item>
      </Form>
      <Button block color="primary" size="large" onClick={handleSubmit}>
        提交到达打卡
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
