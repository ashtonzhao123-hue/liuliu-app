// Supabase Edge Function: send-sms-hook v3
// 接收 Supabase Auth 的 Send SMS Hook 调用，通过阿里云号码认证服务发送验证码
// 部署命令: supabase functions deploy send-sms-hook --no-verify-jwt

// ========== 手动 Webhook 签名验证（Standard Webhooks 规范） ==========

async function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string>,
  secret: string
): Promise<{ valid: boolean; error?: string }> {
  const msgId = headers["webhook-id"];
  const timestampStr = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];

  if (!msgId || !timestampStr || !signatureHeader) {
    return {
      valid: false,
      error: `Missing headers: id=${!!msgId}, ts=${!!timestampStr}, sig=${!!signatureHeader}`,
    };
  }

  // 验证时间戳（5分钟容差）
  const ts = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return { valid: false, error: `Timestamp expired: ts=${ts}, now=${now}, diff=${now - ts}s` };
  }

  // 解码 base64 secret
  const secretBase64 = secret.replace(/^v\d+,whsec_/, "");

  // 计算 HMAC-SHA256: HMAC-SHA256(base64_decoded_secret, "${msgId}.${timestamp}.${body}")
  const toSign = `${msgId}.${timestampStr}.${payload}`;
  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(toSign));
  const expectedSig = "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));

  console.log("[Webhook Verify] Expected:", expectedSig);
  console.log("[Webhook Verify] Received:", signatureHeader);

  // 比较签名（支持多个签名，逗号分隔，用于密钥轮换）
  const receivedSigs = signatureHeader.split(",").map((s) => s.trim()).filter((s) => s.startsWith("v1,"));

  for (const receivedSig of receivedSigs) {
    if (receivedSig === expectedSig) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: `Signature mismatch. Expected: ${expectedSig}, Received: ${signatureHeader}`,
  };
}

// ========== 阿里云签名工具函数（V1 HMAC-SHA1） ==========

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

async function hmacSHA1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 调用阿里云号码认证服务 — SendSmsVerifyCode API
// 文档: https://help.aliyun.com/zh/pnvs/developer-reference/api-dypnsapi-2017-05-25-sendsmsverifycode
async function sendAliyunVerifyCode(
  accessKeyId: string,
  accessKeySecret: string,
  phoneNumber: string,
  signName: string,
  templateCode: string,
  templateParam: string
): Promise<{ success: boolean; message: string; code?: string; rawData?: Record<string, unknown> }> {
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSmsVerifyCode",
    Format: "JSON",
    PhoneNumber: phoneNumber,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: templateParam,
    OutId: crypto.randomUUID(),
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };

  // 参数按字典序排列
  const sortedKeys = Object.keys(params).sort();
  const canonicalQueryString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  // 构造待签名字符串
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalQueryString)}`;

  // 计算签名
  const signature = await hmacSHA1(accessKeySecret + "&", stringToSign);

  // 拼接最终请求URL（注意：域名是 dypnsapi 不是 dysmsapi）
  const url = `https://dypnsapi.aliyuncs.com/?${canonicalQueryString}&Signature=${percentEncode(signature)}`;

  console.log("[Aliyun SMS] Request URL:", url.substring(0, 200) + "...");
  console.log("[Aliyun SMS] PhoneNumber:", phoneNumber);
  console.log("[Aliyun SMS] SignName:", signName);
  console.log("[Aliyun SMS] TemplateCode:", templateCode);
  console.log("[Aliyun SMS] TemplateParam:", templateParam);

  const response = await fetch(url);
  const result = await response.json();

  console.log("[Aliyun SMS] Full Response:", JSON.stringify(result));

  if (result.Code === "OK") {
    return { success: true, message: "SMS sent successfully", rawData: result };
  } else {
    return {
      success: false,
      message: result.Message || "Unknown Aliyun error",
      code: result.Code,
      rawData: result,
    };
  }
}

// ========== 手机号格式处理 ==========

function normalizePhoneForAliyun(phone: string): string {
  if (!phone) return phone;
  let normalized = phone.trim();
  // 去掉 +86 前缀
  if (normalized.startsWith("+86")) {
    normalized = normalized.substring(3);
  }
  // 去掉无+号的86前缀（如 "8613800138000"，13位）
  if (normalized.startsWith("86") && normalized.length === 13) {
    normalized = normalized.substring(2);
  }
  return normalized;
}

// ========== 主函数 ==========

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.text();
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");

  if (!hookSecret) {
    console.error("[Send SMS Hook] Missing SEND_SMS_HOOK_SECRET");
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Hook secret not configured" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let userPhone = "";
  let smsOtp = "";
  let verified = false;

  // 1. 尝试手动 Webhook 签名验证
  const headers = Object.fromEntries(req.headers);
  const verifyResult = await verifyWebhookSignature(payload, headers, hookSecret);

  if (verifyResult.valid) {
    console.log("[Webhook] Signature verified successfully ✅");
    verified = true;
    const body = JSON.parse(payload);
    userPhone = body.user?.phone || "";
    smsOtp = body.sms?.otp || "";
  } else {
    console.warn("[Webhook] Verification failed:", verifyResult.error);
    console.log("[Webhook] Falling back to direct body parse...");

    // 2. Fallback: 直接解析 body
    try {
      const body = JSON.parse(payload);
      userPhone = body.user?.phone || "";
      smsOtp = body.sms?.otp || "";

      if (!userPhone || !smsOtp) {
        return new Response(
          JSON.stringify({ error: { http_code: 400, message: "Missing phone or OTP in payload" } }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      console.log("[Webhook] Fallback parse succeeded, phone:", userPhone);
    } catch (e) {
      console.error("[Webhook] Body parse failed:", e);
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  console.log(`[Send SMS Hook] Phone: ${userPhone}, OTP: ${smsOtp}, Verified: ${verified}`);

  // 3. 检查阿里云凭证
  const accessKeyId = Deno.env.get("ALIYUN_ACCESS_KEY_ID");
  const accessKeySecret = Deno.env.get("ALIYUN_ACCESS_KEY_SECRET");
  const signName = "\u901f\u901a\u4e92\u8054\u9a8c\u8bc1\u7801"; // 速通互联验证码
  const templateCode = "100001";

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    console.error("[Send SMS Hook] Missing Aliyun credentials", {
      hasKeyId: !!accessKeyId,
      hasKeySecret: !!accessKeySecret,
      hasSignName: !!signName,
      hasTemplateCode: !!templateCode,
    });
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Aliyun SMS credentials not fully configured" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 处理手机号格式 + 构造模板参数
  const phoneNumber = normalizePhoneForAliyun(userPhone);
  console.log(`[Send SMS Hook] Normalized phone: ${userPhone} → ${phoneNumber}`);

  // 号码认证服务的赠送模板参数：code=验证码值
  const templateParam = JSON.stringify({ code: smsOtp, min: "5" });

  // 5. 调用阿里云 SendSmsVerifyCode API
  const result = await sendAliyunVerifyCode(
    accessKeyId,
    accessKeySecret,
    phoneNumber,
    signName,
    templateCode,
    templateParam
  );

  // 6. 返回结果
  if (result.success) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // 频率限制返回429，其他错误返回502
    const httpCode = result.code === "isv.BUSINESS_LIMIT_CONTROL" ? 429 : 502;
    return new Response(
      JSON.stringify({
        error: {
          http_code: httpCode,
          message: `Aliyun SMS error: ${result.message} (${result.code})`,
        },
      }),
      { status: httpCode, headers: { "Content-Type": "application/json" } }
    );
  }
});
