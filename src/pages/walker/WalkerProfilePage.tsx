import { useEffect, useState } from 'react';
import { Card, List, Switch, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { getWalkerOnlineStatus, getWalkerStats, setWalkerOnlineStatus, type WalkerStats } from '../../api/walker';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';

export function WalkerProfilePage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const setRoleMode = useAppStore((state) => state.setRoleMode);
  const logout = useAppStore((state) => state.logout);
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState<WalkerStats>({ todayIncome: 0, weekIncome: 0, totalIncome: 0, serviceCount: 0, averageRating: 5, petCount: 0, totalDistance: 0 });

  useEffect(() => {
    if (!currentUser) return;
    setOnline(getWalkerOnlineStatus(currentUser.id));
    void getWalkerStats(currentUser.id).then(setStats);
  }, [currentUser]);

  async function handleLogout() {
    try {
      await logout();
      notify('已退出登录，等你回来', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '退出登录失败，请稍后再试'), 'error');
    }
  }

  return (
    <PageContainer title="服务者我的" subtitle={currentUser?.nickname ?? '用户'}>
      <Card className="summary-card" title="学生认证状态">
        <div className="card-row">
          <Tag color="success">已通过</Tag>
          <Switch
            checked={online}
            onChange={(checked) => {
              if (!currentUser) return;
              setOnline(checked);
              setWalkerOnlineStatus(currentUser.id, checked);
            }}
          />
        </div>
      </Card>
      <section className="metric-grid">
        <div className="metric"><p className="metric__label">今日收入</p><p className="metric__value">{formatMoney(stats.todayIncome)}</p></div>
        <div className="metric"><p className="metric__label">本周收入</p><p className="metric__value">{formatMoney(stats.weekIncome)}</p></div>
        <div className="metric"><p className="metric__label">累计收入</p><p className="metric__value">{formatMoney(stats.totalIncome)}</p></div>
        <div className="metric"><p className="metric__label">评分/次数</p><p className="metric__value">{stats.averageRating} / {stats.serviceCount}</p></div>
      </section>
      <List className="section-stack">
        <List.Item>我的认证</List.Item>
        <List.Item onClick={() => navigate('/walker/history')}>服务记录</List.Item>
        <List.Item>我的收益</List.Item>
        <List.Item>提现记录</List.Item>
        <List.Item>消息中心</List.Item>
        <List.Item onClick={() => { setRoleMode('owner'); navigate('/owner'); }}>切换为主人模式</List.Item>
        <List.Item>设置</List.Item>
        <List.Item onClick={handleLogout}>退出登录</List.Item>
      </List>
    </PageContainer>
  );
}
