import { useEffect, useState } from 'react';
import { Button, Card, TextArea, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrderBundle, submitReview } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { ScorePicker } from '../../components/ScorePicker';
import { useAppStore } from '../../stores/useAppStore';
import type { Order } from '../../types';

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [order, setOrder] = useState<Order>();
  const [scores, setScores] = useState({ rating: 5, punctualScore: 5, attitudeScore: 5, petFriendlyScore: 5, requirementScore: 5 });
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!currentUser || !id) return;
    void getOrderBundle(currentUser.id, id).then((bundle) => setOrder(bundle.order));
  }, [currentUser, id]);

  async function handleSubmit() {
    if (!currentUser || !order) return;
    await submitReview(currentUser.id, order.id, { ...scores, content });
    Toast.show('评价已提交');
    navigate(`/owner/orders/${order.id}`, { replace: true });
  }

  return (
    <PageContainer title="评价服务" subtitle="你的反馈会帮助平台提升服务">
      <Card className="summary-card" title="服务者信息">
        <p>{order?.walkerNicknameSnapshot || '林同学'} · 学生认证</p>
      </Card>
      <Card className="summary-card" title="评分">
        <ScorePicker label="总体评分" value={scores.rating} onChange={(rating) => setScores({ ...scores, rating })} />
        <ScorePicker label="准时" value={scores.punctualScore} onChange={(punctualScore) => setScores({ ...scores, punctualScore })} />
        <ScorePicker label="态度" value={scores.attitudeScore} onChange={(attitudeScore) => setScores({ ...scores, attitudeScore })} />
        <ScorePicker label="宠物友好度" value={scores.petFriendlyScore} onChange={(petFriendlyScore) => setScores({ ...scores, petFriendlyScore })} />
        <ScorePicker label="按要求执行" value={scores.requirementScore} onChange={(requirementScore) => setScores({ ...scores, requirementScore })} />
      </Card>
      <TextArea className="textarea-panel" rows={5} placeholder="写下你的评价" value={content} onChange={setContent} />
      <Button block color="primary" size="large" onClick={handleSubmit}>
        提交评价
      </Button>
    </PageContainer>
  );
}
