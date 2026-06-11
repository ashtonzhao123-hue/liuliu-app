import { useState } from 'react';
import { Button, Form, Selector, TextArea, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { submitComplaint } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import type { ComplaintType } from '../../types';

const complaintOptions = [
  { label: '服务者失联', value: 'lost_contact' },
  { label: '服务过程异常', value: 'service_exception' },
  { label: '宠物状态异常', value: 'pet_exception' },
  { label: '费用争议', value: 'fee_dispute' },
  { label: '其他', value: 'other' }
];

export function ComplaintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [complaintType, setComplaintType] = useState<ComplaintType>('service_exception');
  const [content, setContent] = useState('');

  async function handleSubmit() {
    if (!currentUser || !id || !content.trim()) {
      Toast.show('请填写问题说明');
      return;
    }
    await submitComplaint(currentUser.id, id, { complaintType, content });
    Toast.show('投诉已提交，平台会尽快处理');
    navigate(`/owner/orders/${id}`, { replace: true });
  }

  return (
    <PageContainer title="投诉反馈" subtitle="平台会根据轨迹和打卡记录介入">
      <Form layout="vertical" className="owner-form">
        <Form.Item label="投诉类型">
          <Selector
            value={[complaintType]}
            options={complaintOptions}
            onChange={(value) => setComplaintType((value[0] ?? 'other') as ComplaintType)}
          />
        </Form.Item>
        <Form.Item label="问题说明">
          <TextArea rows={6} value={content} onChange={setContent} />
        </Form.Item>
      </Form>
      <div className="upload-placeholder">证据上传占位</div>
      <Button block color="primary" size="large" onClick={handleSubmit}>
        提交投诉
      </Button>
    </PageContainer>
  );
}
