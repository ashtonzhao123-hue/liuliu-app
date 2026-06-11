import { useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

export function LoginPage() {
  const navigate = useNavigate();
  const loginWithCode = useAppStore((state) => state.loginWithCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => email.includes('@') && password.length >= 6 && !submitting, [email, password, submitting]);

  async function handleLogin() {
    if (!agreed) {
      notify('先勾一下协议，我们再进来');
      return;
    }

    try {
      setSubmitting(true);
      const result = await loginWithCode({ mobile: email, code: password, email, password });
      notify('欢迎回来，出门遛个弯吧', 'success');
      navigate(result.nextPath, { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '登录遇到点小问题，再试一次？'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--login">
      <section className="auth-panel" aria-label="登录">
        <div className="song-dog-mark" aria-hidden="true">
          <img src="/song-login-reference.jpg" alt="" />
        </div>
        <h1 className="auth-title">遛遛</h1>
        <p className="auth-subtitle">出门遛个弯的事儿</p>

        <Form layout="vertical" footer={null} className="auth-form">
          <Form.Item label="邮箱">
            <Input inputMode="email" placeholder="你的邮箱" value={email} onChange={setEmail} />
          </Form.Item>
          <Form.Item label="密码">
            <div className="password-field">
              <Input type={passwordVisible ? 'text' : 'password'} placeholder="设个密码" value={password} onChange={setPassword} />
              <button className="icon-button" type="button" aria-label={passwordVisible ? '隐藏密码' : '显示密码'} onClick={() => setPasswordVisible(!passwordVisible)}>
                {passwordVisible ? <EyeInvisibleOutline /> : <EyeOutline />}
              </button>
            </div>
          </Form.Item>
        </Form>

        <Checkbox className="agreement" checked={agreed} onChange={(checked) => setAgreed(Boolean(checked))}>
          我已读过并同意 <span className="link-text">《用户协议》</span> 和 <span className="link-text">《隐私政策》</span>
        </Checkbox>

        <Button block color="primary" size="large" loading={submitting} disabled={!canSubmit} onClick={() => void handleLogin()}>
          {submitting ? '进来中...' : '进来'}
        </Button>

        <p className="auth-switch">
          还没来过？<Link to="/register">先注册</Link>
        </p>
      </section>
    </main>
  );
}
