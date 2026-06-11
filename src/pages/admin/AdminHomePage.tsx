import { useEffect, useState } from 'react';
import { Button, Card, Dialog, Empty, Form, Input, List, Selector, Space, Tabs, Tag, Toast } from 'antd-mobile';
import {
  cancelAdminOrder,
  getAdminDashboard,
  isAdminLoggedIn,
  listAdminComplaints,
  listAdminOrders,
  listAdminPets,
  listWalkerApplications,
  loginAdmin,
  logoutAdmin,
  markAdminOrderException,
  reviewAdminPet,
  reviewWalkerApplication,
  updateAdminComplaintStatus,
  type AdminComplaintRecord,
  type AdminDashboardStats,
  type AdminOrderBundle,
  type AdminPetRecord,
  type WalkerApplication
} from '../../api/admin';
import { getPetBreedLabel } from '../../api/owner';
import { ComplaintStatus, OrderStatus, PetReviewStatus, WalkerAuthStatus } from '../../types';
import { formatDateTime, formatMoney } from '../../utils/format';
import { getOrderStatusText, getPetReviewText, getRiskLevelText } from '../../utils/status';

const orderStatusOptions = [
  { label: '全部', value: 'all' },
  { label: '待接单', value: String(OrderStatus.PendingAccept) },
  { label: '待支付', value: String(OrderStatus.PendingPay) },
  { label: '进行中', value: String(OrderStatus.InService) },
  { label: '待确认', value: String(OrderStatus.PendingOwnerConfirm) },
  { label: '已完成', value: String(OrderStatus.Completed) },
  { label: '异常', value: String(OrderStatus.ExceptionHandling) }
];

const petStatusOptions = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: String(PetReviewStatus.PendingReview) },
  { label: '已通过', value: String(PetReviewStatus.Approved) },
  { label: '已拒绝', value: String(PetReviewStatus.Rejected) }
];

export function AdminHomePage() {
  const [loggedIn, setLoggedIn] = useState(() => isAdminLoggedIn());

  if (!loggedIn) {
    return <AdminLoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return <AdminDashboardPage onLogout={() => { logoutAdmin(); setLoggedIn(false); }} />;
}

function AdminLoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');

  function handleLogin() {
    if (!loginAdmin(password)) {
      Toast.show('密码错误');
      return;
    }
    Toast.show('登录成功');
    onLogin();
  }

  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <h1>遛狗平台后台</h1>
        <Form layout="vertical" className="owner-form">
          <Form.Item label="账号">
            <Input value="admin" disabled />
          </Form.Item>
          <Form.Item label="密码">
            <Input type="password" value={password} placeholder="请输入后台密码" onChange={setPassword} />
          </Form.Item>
        </Form>
        <Button block color="primary" size="large" onClick={handleLogin}>
          登录
        </Button>
      </section>
    </main>
  );
}

function AdminDashboardPage({ onLogout }: { onLogout: () => void }) {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>遛狗平台后台</h1>
          <p>审核、订单、投诉与认证管理</p>
        </div>
        <Button size="small" fill="outline" onClick={onLogout}>
          退出
        </Button>
      </header>
      <Tabs>
        <Tabs.Tab title="数据看板" key="dashboard">
          <DashboardPanel />
        </Tabs.Tab>
        <Tabs.Tab title="订单管理" key="orders">
          <OrderPanel />
        </Tabs.Tab>
        <Tabs.Tab title="宠物审核" key="pets">
          <PetReviewPanel />
        </Tabs.Tab>
        <Tabs.Tab title="投诉管理" key="complaints">
          <ComplaintPanel />
        </Tabs.Tab>
        <Tabs.Tab title="服务者认证" key="walkers">
          <WalkerApplicationPanel />
        </Tabs.Tab>
      </Tabs>
    </main>
  );
}

function DashboardPanel() {
  const [stats, setStats] = useState<AdminDashboardStats>();

  useEffect(() => {
    void getAdminDashboard().then(setStats);
  }, []);

  if (!stats) return null;

  const cards = [
    ['总用户数', stats.totalUsers],
    ['总订单数', stats.totalOrders],
    ['今日新增订单', stats.todayOrders],
    ['总收入', formatMoney(stats.totalIncome)],
    ['今日收入', formatMoney(stats.todayIncome)],
    ['服务者数量', stats.walkerCount],
    ['主人数量', stats.ownerCount],
    ['进行中订单', stats.activeOrders],
    ['已完成订单', stats.completedOrders],
    ['异常订单', stats.exceptionOrders],
    ['待审核宠物', stats.pendingPets],
    ['待审核服务者', stats.pendingWalkers]
  ];

  return (
    <section className="admin-grid">
      {cards.map(([label, value]) => (
        <Card key={label} className="admin-stat-card">
          <p>{label}</p>
          <strong>{value}</strong>
        </Card>
      ))}
    </section>
  );
}

function OrderPanel() {
  const [status, setStatus] = useState('all');
  const [orders, setOrders] = useState<AdminOrderBundle[]>([]);

  async function refresh(nextStatus = status) {
    setOrders(await listAdminOrders(nextStatus as 'all' | `${OrderStatus}`));
  }

  useEffect(() => {
    void refresh(status);
  }, [status]);

  async function handleException(bundle: AdminOrderBundle) {
    await markAdminOrderException(bundle.ownerUserId, bundle.order.id);
    Toast.show('已标记异常');
    void refresh();
  }

  async function handleCancel(bundle: AdminOrderBundle) {
    await cancelAdminOrder(bundle.ownerUserId, bundle.order.id);
    Toast.show('已取消订单');
    void refresh();
  }

  return (
    <section className="admin-panel">
      <Selector value={[status]} options={orderStatusOptions} onChange={(value) => setStatus(value[0] ?? 'all')} />
      {orders.length === 0 ? <Empty description="暂无订单" /> : orders.map((bundle) => (
        <Card key={bundle.order.id} className="summary-card" title={bundle.order.orderNo}>
          <p>主人：{bundle.order.ownerNicknameSnapshot} | 服务者：{bundle.order.walkerNicknameSnapshot || '-'}</p>
          <p>宠物：{bundle.order.petNameSnapshot} | 时长：{bundle.order.serviceDurationMinutes}分钟 | 金额：{formatMoney(bundle.order.amountTotal)}</p>
          <p>创建：{formatDateTime(bundle.order.createdAt)} | 轨迹 {bundle.tracks.length} | 打卡 {bundle.checkpoints.length} | 媒体 {bundle.media.length}</p>
          <Space wrap>
            <Tag color={bundle.order.exceptionFlag ? 'danger' : 'primary'}>{getOrderStatusText(bundle.order.orderStatus)}</Tag>
            {bundle.complaints.length > 0 ? <Tag color="warning">有投诉</Tag> : null}
          </Space>
          <Space wrap className="admin-actions">
            <Button size="small" fill="outline" onClick={() => showOrderDetail(bundle)}>查看详情</Button>
            <Button size="small" color="warning" fill="outline" onClick={() => void handleException(bundle)}>标记异常</Button>
            <Button size="small" color="danger" fill="outline" onClick={() => void handleCancel(bundle)}>手动取消</Button>
          </Space>
        </Card>
      ))}
    </section>
  );
}

function showOrderDetail(bundle: AdminOrderBundle) {
  Dialog.alert({
    title: '订单详情',
    content: (
      <div className="admin-dialog">
        <p>订单号：{bundle.order.orderNo}</p>
        <p>状态：{getOrderStatusText(bundle.order.orderStatus)}</p>
        <p>地址：{bundle.order.addressSnapshot}</p>
        <p>金额：{formatMoney(bundle.order.amountTotal)}，平台抽成 {formatMoney(bundle.order.platformCommission)}</p>
        <p>轨迹点：{bundle.tracks.length}，打卡：{bundle.checkpoints.length}，照片：{bundle.media.length}</p>
      </div>
    )
  });
}

function PetReviewPanel() {
  const [status, setStatus] = useState('all');
  const [pets, setPets] = useState<AdminPetRecord[]>([]);

  async function refresh(nextStatus = status) {
    setPets(await listAdminPets(nextStatus as 'all' | `${PetReviewStatus}`));
  }

  useEffect(() => {
    void refresh(status);
  }, [status]);

  async function handleReview(record: AdminPetRecord, approved: boolean) {
    await reviewAdminPet(record.ownerUserId, record.pet.id, approved);
    Toast.show(approved ? '已审核通过' : '已驳回');
    void refresh();
  }

  return (
    <section className="admin-panel">
      <Selector value={[status]} options={petStatusOptions} onChange={(value) => setStatus(value[0] ?? 'all')} />
      {pets.length === 0 ? <Empty description="暂无宠物" /> : pets.map((record) => (
        <Card key={record.pet.id} className="summary-card" title={record.pet.petName}>
          <p>品种：{getPetBreedLabel(record.pet.breed)} | 体重：{record.pet.weightKg}kg | 主人：{record.ownerUserId}</p>
          <p>咬人史：{record.pet.biteHistory ? '是' : '否'} | 接受陌生人：{record.pet.acceptsStrangers ? '是' : '否'} | 牵引习惯：{record.pet.leashTrained ? '是' : '否'}</p>
          <Space wrap>
            <Tag color="primary">{getRiskLevelText(record.pet.riskLevel)}</Tag>
            <Tag color="warning">{getPetReviewText(record.pet.reviewStatus)}</Tag>
          </Space>
          <Space wrap className="admin-actions">
            <Button size="small" color="primary" onClick={() => void handleReview(record, true)}>审核通过</Button>
            <Button size="small" color="danger" fill="outline" onClick={() => void handleReview(record, false)}>驳回</Button>
          </Space>
        </Card>
      ))}
    </section>
  );
}

function ComplaintPanel() {
  const [records, setRecords] = useState<AdminComplaintRecord[]>([]);

  async function refresh() {
    setRecords(await listAdminComplaints());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleStatus(record: AdminComplaintRecord, status: ComplaintStatus) {
    await updateAdminComplaintStatus(record.ownerUserId, record.complaint.id, status);
    Toast.show('处理状态已更新');
    void refresh();
  }

  return (
    <section className="admin-panel">
      {records.length === 0 ? <Empty description="暂无投诉" /> : records.map((record) => (
        <Card key={record.complaint.id} className="summary-card" title={`投诉 ${record.complaint.id}`}>
          <p>订单：{record.order?.orderNo ?? record.complaint.orderId}</p>
          <p>投诉人：{record.complaint.userId} | 类型：{record.complaint.complaintType}</p>
          <p>内容：{record.complaint.content}</p>
          <p>时间：{formatDateTime(record.complaint.createdAt)}</p>
          <Space wrap>
            <Tag color="primary">{getComplaintText(record.complaint.status)}</Tag>
          </Space>
          <Space wrap className="admin-actions">
            <Button size="small" fill="outline" onClick={() => void handleStatus(record, ComplaintStatus.Processing)}>处理中</Button>
            <Button size="small" color="primary" onClick={() => void handleStatus(record, ComplaintStatus.Completed)}>处理完成</Button>
            <Button size="small" fill="outline" onClick={() => void handleStatus(record, ComplaintStatus.Closed)}>关闭</Button>
          </Space>
        </Card>
      ))}
    </section>
  );
}

function WalkerApplicationPanel() {
  const [applications, setApplications] = useState<WalkerApplication[]>([]);

  async function refresh() {
    setApplications(await listWalkerApplications());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleReview(id: string, approved: boolean) {
    await reviewWalkerApplication(id, approved);
    Toast.show(approved ? '已通过' : '已拒绝');
    void refresh();
  }

  return (
    <section className="admin-panel">
      <List>
        {applications.map((item) => (
          <List.Item
            key={item.id}
            description={`${item.schoolName} | 考试 ${item.examScore} 分 | ${formatDateTime(item.submittedAt)}`}
            extra={<Tag color="primary">{getWalkerAuthText(item.status)}</Tag>}
          >
            <div className="admin-list-title">{item.realName}</div>
            <Space wrap className="admin-actions">
              <Button size="small" color="primary" onClick={() => void handleReview(item.id, true)}>通过</Button>
              <Button size="small" color="danger" fill="outline" onClick={() => void handleReview(item.id, false)}>拒绝</Button>
            </Space>
          </List.Item>
        ))}
      </List>
    </section>
  );
}

function getComplaintText(status: ComplaintStatus): string {
  return {
    [ComplaintStatus.Pending]: '待处理',
    [ComplaintStatus.Processing]: '处理中',
    [ComplaintStatus.Completed]: '已完成',
    [ComplaintStatus.Closed]: '已关闭'
  }[status];
}

function getWalkerAuthText(status: WalkerAuthStatus): string {
  return {
    [WalkerAuthStatus.PendingReview]: '待审核',
    [WalkerAuthStatus.Approved]: '已通过',
    [WalkerAuthStatus.Rejected]: '已拒绝'
  }[status];
}
