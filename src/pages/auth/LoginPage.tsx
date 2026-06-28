import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Button, Checkbox, Form, Input } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { signUpWithPassword } from '../../api/auth';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

const OTP_LENGTH = 6;
const PHONE_STORAGE_KEY = 'liuliu_last_phone';

export function LoginPage() {
  const navigate = useNavigate();
  const sendLoginCode = useAppStore((state) => state.sendLoginCode);
  const loginWithPhoneOtp = useAppStore((state) => state.loginWithPhoneOtp);
  const loginWithPassword = useAppStore((state) => state.loginWithPassword);
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_STORAGE_KEY) ?? '');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [shakeOtp, setShakeOtp] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingTokenRef = useRef('');

  const phoneValid = useMemo(() => /^1[3-9]\d{9}$/.test(phone), [phone]);
  const otpToken = otpDigits.join('');
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canUseEmail = emailValid && password.length >= 6 && !emailSubmitting;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (otpSent) inputRefs.current[0]?.focus();
  }, [otpSent]);

  useEffect(() => {
    if (otpToken.length === OTP_LENGTH && otpDigits.every(Boolean) && verifyingTokenRef.current !== otpToken) {
      verifyingTokenRef.current = otpToken;
      void handleVerifyOtp(otpToken);
    }
  }, [otpToken, otpDigits]);

  function updatePhone(value: string) {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
  }

  async function handleSendOtp() {
    if (!agreed) {
      notify('先勾选协议，我们再继续');
      return;
    }
    if (!phoneValid || countdown > 0) return;

    try {
      setSending(true);
      await sendLoginCode({ phone });
      localStorage.setItem(PHONE_STORAGE_KEY, phone);
      setOtpSent(true);
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      verifyingTokenRef.current = '';
      setCountdown(60);
      notify('验证码已发送', 'success');
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '验证码暂时没发出去，再试一次'), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(token: string) {
    if (!agreed || verifying) return;

    try {
      setVerifying(true);
      const result = await loginWithPhoneOtp({ phone, token });
      notify('欢迎回来，出门遛个弯吧', 'success');
      navigate(result.nextPath, { replace: true });
    } catch (error) {
      setShakeOtp(true);
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      verifyingTokenRef.current = '';
      window.setTimeout(() => setShakeOtp(false), 320);
      inputRefs.current[0]?.focus();
      notify(getFriendlyErrorMessage(error, '验证码错误，请重试'), 'error');
    } finally {
      setVerifying(false);
    }
  }

  function handleDigitInput(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const nextDigits = [...otpDigits];
    nextDigits[index] = value.slice(-1);
    setOtpDigits(nextDigits);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const nextDigits = [...otpDigits];
      nextDigits[index - 1] = '';
      setOtpDigits(nextDigits);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const nextDigits = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] || '');
    setOtpDigits(nextDigits);
    const nextEmpty = nextDigits.findIndex((digit) => !digit);
    inputRefs.current[nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty]?.focus();
  }

  async function handleEmailAuth() {
    if (!agreed) {
      notify('先勾选协议，我们再继续');
      return;
    }

    try {
      setEmailSubmitting(true);
      if (emailMode === 'register') {
        await signUpWithPassword({ email: email.trim(), password });
        notify('账号已创建，请回到邮箱登录', 'success');
        setEmailMode('login');
        return;
      }

      const result = await loginWithPassword({ email: email.trim(), password });
      notify('欢迎回来', 'success');
      navigate(result.nextPath, { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, emailMode === 'register' ? '注册遇到点小问题，再试一次' : '邮箱登录失败，再试一次'), 'error');
    } finally {
      setEmailSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--login">
      <section className="auth-panel auth-panel--phone" aria-label="手机号登录">
        <div className="song-dog-mark" aria-hidden="true">
          <img src="/song-login-reference.jpg" alt="" />
        </div>
        <h1 className="auth-title">遛遛</h1>
        <p className="auth-subtitle">让毛孩子开心出门</p>

        <div className="phone-login">
          <label className="phone-field">
            <span className="phone-field__prefix">+86</span>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="手机号"
              value={formatPhoneDisplay(phone)}
              onChange={(event) => updatePhone(event.target.value)}
            />
          </label>

          {otpSent ? (
            <div className={shakeOtp ? 'otp-grid otp-grid--shake' : 'otp-grid'} aria-label="6位验证码">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  className="otp-cell"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleDigitInput(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                />
              ))}
            </div>
          ) : null}

          <Button block color="primary" size="large" loading={sending} disabled={!phoneValid || countdown > 0 || sending} onClick={() => void handleSendOtp()}>
            {countdown > 0 ? `${countdown}s 后重发` : otpSent ? '重新获取验证码' : '获取验证码'}
          </Button>

          {phone.length === 11 && agreed && !otpSent && countdown === 0 ? (
            <div className="phone-ready-hint">手机号有效，点上面「获取验证码」发送</div>
          ) : null}

          {otpSent ? (
            <Button block color="primary" size="large" loading={verifying} disabled={otpToken.length !== OTP_LENGTH || verifying} onClick={() => void handleVerifyOtp(otpToken)}>
              {verifying ? '正在登录...' : '登录'}
            </Button>
          ) : null}
        </div>

        <Checkbox className="agreement" checked={agreed} onChange={(checked) => setAgreed(Boolean(checked))}>
          我已阅读并同意 <span className="link-text">《用户协议》</span> 和 <span className="link-text">《隐私政策》</span>
        </Checkbox>

        <div className="alternate-login">
          <button className="alternate-login__toggle" type="button" onClick={() => setEmailOpen((value) => !value)}>
            其他登录方式
          </button>
          {emailOpen ? (
            <div className="email-login-panel">
              <Form layout="vertical" footer={null} className="auth-form auth-form--compact">
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
              </Form>
              <Button block fill="outline" loading={emailSubmitting} disabled={!canUseEmail} onClick={() => void handleEmailAuth()}>
                {emailMode === 'register' ? '注册邮箱账号' : '邮箱登录'}
              </Button>
              <button className="email-login-panel__switch" type="button" onClick={() => setEmailMode((mode) => (mode === 'login' ? 'register' : 'login'))}>
                {emailMode === 'login' ? '没有账号？注册' : '已有账号？登录'}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}
