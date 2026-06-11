import { useEffect, useState } from 'react';
import { Button, Card, Dialog, Space, Tag } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { approvePetForDemo, deletePet, getPetBreedLabel, listPets } from '../../api/owner';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { RiskLevel, type Pet } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';
import { getPetReviewText, getRiskLevelText } from '../../utils/status';

export function PetListPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!currentUser) return;
    try {
      setLoading(true);
      setPets(await listPets(currentUser.id));
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '宠物档案没加载出来，稍后再试试'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [currentUser]);

  async function handleDelete(id: string) {
    if (!currentUser) return;
    const pet = pets.find((item) => item.id === id);
    Dialog.confirm({
      title: '确定要删除吗？',
      content: `确定删除${pet?.petName ?? '这只宝贝'}的档案吗？删除后不可恢复哦`,
      confirmText: '删除',
      cancelText: '再想想',
      onConfirm: async () => {
        try {
          await deletePet(currentUser.id, id);
          notify('删好啦', 'success');
          void refresh();
        } catch (error) {
          notify(getFriendlyErrorMessage(error, '删除没成功，我们再试一次'), 'error');
        }
      }
    });
  }

  async function handleApprove(id: string) {
    if (!currentUser) return;
    try {
      await approvePetForDemo(currentUser.id, id);
      notify('搞定！这只宝贝可以下单啦', 'success');
      void refresh();
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '审核状态没更新成功'), 'error');
    }
  }

  return (
    <PageContainer title="我的宠物" subtitle="新增、编辑和查看审核状态">
      <Button block color="primary" onClick={() => navigate('/owner/pets/new')}>
        <AddOutline /> 新增宠物
      </Button>
      <div className="section-stack">
        {loading ? (
          <div className="skeleton-list"><span /><span /><span /></div>
        ) : pets.length === 0 ? (
          <FriendlyEmpty
            title="还没有宠物档案"
            description="添加你的第一只宝贝吧"
            actionText="添加我的宝贝"
            onAction={() => navigate('/owner/pets/new')}
          />
        ) : (
          pets.map((pet) => (
            <Card key={pet.id} className="summary-card swipe-card" title={pet.petName}>
              <Space direction="vertical" block>
                <p>{getPetBreedLabel(pet.breed)} · {pet.weightKg}kg · {pet.ageMonths}月龄</p>
                <Space wrap>
                  <Tag className={`risk-tag risk-tag--${getRiskTone(pet.riskLevel)}`}>{getRiskLevelText(pet.riskLevel)}</Tag>
                  <Tag color={pet.reviewStatus === 2 ? 'success' : 'warning'}>{getPetReviewText(pet.reviewStatus)}</Tag>
                </Space>
                <Space block>
                  <Button size="small" color="primary" fill="outline" onClick={() => navigate(`/owner/pets/${pet.id}/edit`)}>
                    编辑
                  </Button>
                  {pet.reviewStatus === 1 ? (
                    <Button size="small" color="success" fill="outline" onClick={() => void handleApprove(pet.id)}>
                      模拟通过
                    </Button>
                  ) : null}
                  <Button size="small" color="danger" fill="outline" onClick={() => void handleDelete(pet.id)}>
                    删除
                  </Button>
                </Space>
              </Space>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}

function getRiskTone(level: RiskLevel): string {
  if (level === RiskLevel.A) return 'low';
  if (level === RiskLevel.B) return 'mid';
  return 'high';
}
