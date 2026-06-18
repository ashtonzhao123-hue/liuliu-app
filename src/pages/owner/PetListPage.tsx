import { useEffect, useState } from 'react';
import { Button, Card, Dialog, Space, Tag } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { deletePet, getPetBreedLabel, listPets } from '../../api/owner';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { PetReviewStatus, RiskLevel, type Pet } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';
import { getPetReviewText, getRiskLevelText } from '../../utils/status';

export function PetListPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const nextPets = await listPets(currentUser.id);
      setPets(nextPets);
      setSelectedPetId((current) => current && nextPets.some((pet) => pet.id === current) ? current : nextPets[0]?.id);
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '宠物档案没有加载出来，稍后再试试'), 'error');
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
      content: `确定删除 ${pet?.petName ?? '这只宝贝'} 的档案吗？删除后不可恢复。`,
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

  return (
    <PageContainer title="我的宠物" subtitle="给每只毛孩子留一份清楚档案">
      <div className="pet-list-toolbar">
        <Button color="primary" onClick={() => navigate('/owner/pets/new')}>
          <AddOutline /> 添只毛孩子
        </Button>
      </div>

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
        <div className="pet-carousel" aria-label="宠物档案">
          {pets.map((pet) => (
            <Card
              key={pet.id}
              className={`pet-wallet-card ${pet.id === selectedPetId ? 'pet-wallet-card--active' : ''}`}
              onClick={() => setSelectedPetId(pet.id)}
            >
              <div className="pet-wallet-avatar">{pet.petName.slice(0, 1)}</div>
              <div className="pet-wallet-meta">
                <strong>{pet.petName}</strong>
                <span>{getPetBreedLabel(pet.breed)} · {pet.weightKg}kg · {pet.ageMonths}个月</span>
              </div>
              <Space wrap>
                <Tag className={`risk-tag risk-tag--${getRiskTone(pet.riskLevel)}`}>{getRiskLevelText(pet.riskLevel)}</Tag>
                <Tag color={pet.reviewStatus === PetReviewStatus.Approved ? 'success' : 'warning'}>{getPetReviewText(pet.reviewStatus)}</Tag>
              </Space>
              <Space block>
                <Button size="small" color="primary" fill="outline" onClick={(event) => { event.stopPropagation(); navigate(`/owner/pets/${pet.id}/edit`); }}>
                  编辑
                </Button>
                <Button size="small" color="danger" fill="outline" onClick={(event) => { event.stopPropagation(); void handleDelete(pet.id); }}>
                  删除
                </Button>
              </Space>
            </Card>
          ))}
          <button className="add-pet-dashed" type="button" onClick={() => navigate('/owner/pets/new')}>
            <AddOutline />
            <span>添加宠物</span>
          </button>
        </div>
      )}
    </PageContainer>
  );
}

function getRiskTone(level: RiskLevel): string {
  if (level === RiskLevel.A) return 'low';
  if (level === RiskLevel.B) return 'mid';
  return 'high';
}
