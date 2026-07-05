import { useState } from 'react';
import { Button, ImageUploader, Toast, type ImageUploadItem } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import {
  saveWalkerStudentCredential,
  uploadWalkerCredentialImage
} from '../../api/walkerCredential';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';

interface CredentialUploadItem extends ImageUploadItem {
  extra?: {
    storagePath?: string;
  };
}

export function WalkerCredentialPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [studentCard, setStudentCard] = useState<CredentialUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function uploadStudentCard(file: File): Promise<CredentialUploadItem> {
    if (!currentUser) throw new Error('请先登录');
    const storagePath = await uploadWalkerCredentialImage(currentUser.id, file);
    return {
      url: URL.createObjectURL(file),
      extra: { storagePath }
    };
  }

  async function handleSubmit() {
    if (!currentUser) return;
    const storagePath = studentCard[0]?.extra?.storagePath;
    if (!storagePath) {
      Toast.show('请先上传学生证照片');
      return;
    }

    try {
      setSubmitting(true);
      await saveWalkerStudentCredential(currentUser.id, storagePath);
      Toast.show('已保存，可以开始接单了');
      navigate('/walker', { replace: true });
    } catch (error) {
      Toast.show(getFriendlyErrorMessage(error, '上传没成功，再试一次'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer title="留个学生身份" subtitle="上传后不用等审核，可以直接去接单">
      <section className="credential-card">
        <h2>学生证照片</h2>
        <p className="credential-desc">请上传清晰照片，能看清姓名、学校或学号就行。证件只做平台留痕，不会展示给其他用户。</p>
        <ImageUploader
          value={studentCard}
          onChange={setStudentCard}
          upload={uploadStudentCard}
          maxCount={1}
          accept="image/*"
          capture="environment"
        />
      </section>

      <Button block color="primary" size="large" loading={submitting} disabled={submitting} onClick={() => void handleSubmit()}>
        提交并进入首页
      </Button>
      <button className="credential-skip" type="button" onClick={() => navigate('/walker', { replace: true })}>
        稍后再说
      </button>
      <p className="credential-privacy">如果后续发生纠纷，平台会用这份留痕做身份追溯。</p>
    </PageContainer>
  );
}
