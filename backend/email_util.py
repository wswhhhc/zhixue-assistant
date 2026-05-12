import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS


def send_verification_code(to_email: str, code: str) -> bool:
    """发送邮箱验证码。
    如果 SMTP 已配置则真实发送，否则仅打印到控制台（演示模式）。
    """
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        print("\n" + "=" * 50)
        print(f"[邮箱验证码 - 演示模式]")
        print(f"  收件人: {to_email}")
        print(f"  验证码: {code}")
        print(f"  有效期: 5 分钟")
        print("=" * 50 + "\n")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = "智学助手 - 邮箱验证码"

        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin:0 auto; padding:32px 24px; background:#f8f9ff; border-radius:16px;">
            <div style="text-align:center; margin-bottom:24px;">
                <h2 style="color:#667eea; margin:0;">智学助手</h2>
                <p style="color:#999; font-size:13px;">AI 驱动的高数学习伴侣</p>
            </div>
            <p style="font-size:14px; color:#333;">您好，您的注册验证码为：</p>
            <div style="text-align:center; margin:24px 0; padding:16px; background:#fff; border-radius:12px;">
                <span style="font-size:40px; letter-spacing:12px; font-weight:bold; color:#667eea;">{code}</span>
            </div>
            <p style="font-size:13px; color:#666;">验证码有效期为 5 分钟，请尽快完成注册。</p>
            <p style="font-size:12px; color:#bbb; margin-top:24px;">如果这不是您本人的操作，请忽略此邮件。</p>
        </div>
        """

        msg.attach(MIMEText(body, "html", "utf-8"))

        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()

        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return True

    except Exception as e:
        print(f"[email] send failed: {e}")
        return False
