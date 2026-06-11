import { useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

export function RegisterPage() {
  const navigate = useNavigate();
  const signUp = useAppStore((state) => state.signUpWithPassword);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = useMemo(
    () => email.includes('@') && password.length >= 6 && confirmPassword.length >= 6 && passwordsMatch && !submitting,
    [confirmPassword.length, email, password.length, passwordsMatch, submitting],
  );

  async function handleRegister() {
    if (!agreed) {
      notify('先勾一下协议，我们再继续');
      return;
    }

    if (!passwordsMatch) {
      notify('两次密码没对上，再确认一下？', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await signUp({ email, password });
      notify('账号备好了，回登录页进来吧', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '注册遇到点小问题，再试一次？'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--register">
      <section className="auth-panel" aria-label="注册">
        <div className="song-dog-mark song-dog-mark--small" aria-hidden="true">
          <img src="/song-login-reference.jpg" alt="" />
        </div>
        <h1 className="auth-title">来遛遛吧</h1>
        <p className="auth-subtitle">先留个邮箱，之后就认得你了</p>

        <Form layout="vertical" footer={null} className="auth-form">
          <Form.Item label="邮箱">
            <Input inputMode="email" placeholder="你的邮箱" value={email} onChange={setEmail} />
          </Form.Item>
          <Form.Item label="密码">
            <div className="password-field">
              <Input type={passwordVisible ? 'text' : 'password'} placeholder="至少 6 位" value={password} onChange={setPassword} />
              <button className="icon-button" type="button" aria-label={passwordVisible ? '隐藏密码' : '显示密码'} onClick={() => setPasswordVisible(!passwordVisible)}>
                {passwordVisible ? <EyeInvisibleOutline /> : <EyeOutline />}
              </button>
            </div>
          </Form.Item>
          <Form.Item label="再输一次">
            <div className="password-field">
              <Input type={confirmVisible ? 'text' : 'password'} placeholder="再确认一遍" value={confirmPassword} onChange={setConfirmPassword} />
              <button className="icon-button" type="button" aria-label={confirmVisible ? '隐藏密码' : '显示密码'} onClick={() => setConfirmVisible(!confirmVisible)}>
                {confirmVisible ? <EyeInvisibleOutline /> : <EyeOutline />}
              </button>
            </div>
          </Form.Item>
        </Form>

        <Checkbox className="agreement" checked={agreed} onChange={(checked) => setAgreed(Boolean(checked))}>
          我已读过并同意 <span className="link-text">《用户协议》</span> 和 <span className="link-text">《隐私政策》</span>
        </Checkbox>

        <Button block color="primary" size="large" loading={submitting} disabled={!canSubmit} onClick={() => void handleRegister()}>
          {submitting ? '备着...' : '好了，下一步'}
        </Button>

        <p className="auth-switch">
          已经有了？<Link to="/login">直接进来</Link>
        </p>
      </section>
    </main>
  );
}
