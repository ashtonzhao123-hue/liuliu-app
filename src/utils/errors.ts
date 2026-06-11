export function getFriendlyErrorMessage(error: unknown, fallback = '操作失败，请稍后再试'): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return fallback;

  if (/invalid login credentials/i.test(message)) {
    return '邮箱或密码不对，再想想？';
  }

  if (/user already registered|already registered/i.test(message)) {
    return '这个邮箱已经注册过了，直接登录吧';
  }

  if (/email/i.test(message) && /invalid/i.test(message)) {
    return '邮箱格式好像不太对';
  }

  if (/network|fetch|failed to fetch|load failed/i.test(message)) {
    return '网络好像不太给力，稍后再试试';
  }

  if (/duplicate key|already exists|unique constraint/i.test(message)) {
    return '该信息已存在，请检查后再提交';
  }

  if (/violates not-null constraint|null value/i.test(message)) {
    return '请补充完整信息后再提交';
  }

  if (/violates foreign key constraint|foreign key/i.test(message)) {
    return '关联信息不存在，请返回上一页重新选择';
  }

  if (/invalid input syntax|invalid .*value|out of range|numeric field overflow/i.test(message)) {
    return '填写格式不正确，请检查后再提交';
  }

  if (/row-level security|permission denied|not authorized|unauthorized|forbidden/i.test(message)) {
    return '当前账号暂时不能操作这里哦';
  }

  if (/jwt|token|session/i.test(message)) {
    return '先登录才能继续哦';
  }

  return /[\u4e00-\u9fff]/.test(message) ? message : fallback;
}
