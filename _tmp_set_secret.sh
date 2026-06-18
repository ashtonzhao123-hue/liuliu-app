#!/bin/bash
# 用 bash 设置带中文的 secret（bash 默认 UTF-8，避免 Windows CMD GBK 编码问题）
echo "请输入阿里云签名名称（如：速通互联验证码）："
read SIGN_NAME
echo "请输入阿里云模板CODE（如：100001）："
read TEMPLATE_CODE
npx supabase secrets set "ALIYUN_SMS_SIGN_NAME=$SIGN_NAME" "ALIYUN_SMS_TEMPLATE_CODE=$TEMPLATE_CODE"
rm _tmp_set_secret.sh
