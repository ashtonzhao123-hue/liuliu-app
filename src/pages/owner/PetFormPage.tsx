import { useEffect, useState } from 'react';
import { Button, Form, Input, Picker, Selector, Switch, TextArea } from 'antd-mobile';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PET_BREEDS, getPet, savePet, type PetInput } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import type { PetBreedCode, PetGender } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

const defaultForm: PetInput = {
  petName: '',
  breed: 'BICHON',
  gender: 1,
  ageMonths: 12,
  weightKg: 5,
  neutered: 0,
  vaccinated: 1,
  acceptsStrangers: 1,
  biteHistory: 0,
  jumpPeople: 0,
  leashTrained: 1,
  healthNote: '',
  remark: ''
};

interface PetFormIssue {
  field: keyof PetInput;
  message: string;
}

export function PetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppStore((state) => state.currentUser);
  const [form, setForm] = useState<PetInput>(defaultForm);
  const [breedVisible, setBreedVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issue, setIssue] = useState<PetFormIssue>();
  const isOnboarding = (location.state as { onboarding?: boolean } | null)?.onboarding === true;

  useEffect(() => {
    if (!currentUser || !id) return;
    void getPet(currentUser.id, id).then((pet) => {
      if (pet) {
        setForm({
          petName: pet.petName,
          avatarUrl: pet.avatarUrl,
          breed: pet.breed as PetBreedCode,
          gender: pet.gender,
          ageMonths: pet.ageMonths,
          weightKg: pet.weightKg,
          neutered: pet.neutered,
          vaccinated: pet.vaccinated,
          acceptsStrangers: pet.acceptsStrangers,
          biteHistory: pet.biteHistory,
          jumpPeople: pet.jumpPeople,
          leashTrained: pet.leashTrained,
          healthNote: pet.healthNote,
          remark: pet.remark
        });
      }
    });
  }, [currentUser, id]);

  async function handleSubmit() {
    if (!currentUser) return;
    const nextIssue = validatePetForm(form);
    if (nextIssue) {
      setIssue(nextIssue);
      notify(nextIssue.message, 'error');
      return;
    }

    try {
      setIssue(undefined);
      setSubmitting(true);
      await savePet(currentUser.id, form, id);
      notify('宝贝档案已提交，等审核通过就能下单啦', 'success');
      navigate('/owner/pets', { replace: true });
    } catch (error) {
      const apiIssue = getPetIssueFromApiError(error);
      if (apiIssue) {
        setIssue(apiIssue);
        notify(apiIssue.message, 'error');
      } else {
        notify(getFriendlyErrorMessage(error, '宠物信息没有保存成功，请检查后再提交'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer title={id ? '编辑宠物' : '新增宠物'} subtitle="当前平台仅支持小型犬和低风险犬只">
      <div className="upload-placeholder">上传宠物照片</div>
      <Form layout="vertical" className="owner-form">
        <Form.Item label="宠物昵称">
          <Input value={form.petName} placeholder="例如：豆豆" onChange={(petName) => updateForm({ petName })} />
          <FieldIssue issue={issue} field="petName" />
        </Form.Item>
        <Form.Item label="品种">
          <Button block fill="outline" onClick={() => setBreedVisible(true)}>
            {PET_BREEDS.find((breed) => breed.code === form.breed)?.label}
          </Button>
          <p className="field-hint">目前支持：比熊、贵宾/泰迪、博美、雪纳瑞、吉娃娃、约克夏、柯基。</p>
          <FieldIssue issue={issue} field="breed" />
        </Form.Item>
        <Form.Item label="性别">
          <Selector
            value={[String(form.gender)]}
            options={[{ label: '公', value: '1' }, { label: '母', value: '2' }]}
            onChange={(value) => updateForm({ gender: Number(value[0] ?? 1) as PetGender })}
          />
          <FieldIssue issue={issue} field="gender" />
        </Form.Item>
        <Form.Item label="年龄（月）">
          <Input type="number" value={String(form.ageMonths)} onChange={(value) => updateForm({ ageMonths: Number(value) })} />
          <p className="field-hint">请填写 1-240 之间的月龄，例如 12 表示 1 岁。</p>
          <FieldIssue issue={issue} field="ageMonths" />
        </Form.Item>
        <Form.Item label="体重（kg）">
          <Input type="number" value={String(form.weightKg)} onChange={(value) => updateForm({ weightKg: Number(value) })} />
          <p className="field-hint">{getBreedWeightHint(form.breed)}</p>
          <FieldIssue issue={issue} field="weightKg" />
        </Form.Item>
        {[
          ['neutered', '是否绝育'],
          ['vaccinated', '是否打疫苗'],
          ['acceptsStrangers', '是否接受陌生人'],
          ['biteHistory', '是否有咬人史'],
          ['jumpPeople', '是否会扑人'],
          ['leashTrained', '是否有牵引习惯']
        ].map(([key, label]) => (
          <Form.Item key={key} label={label}>
            <Switch
              checked={Boolean(form[key as keyof PetInput])}
              onChange={(checked) => updateForm({ [key]: checked ? 1 : 0 })}
            />
            <FieldIssue issue={issue} field={key as keyof PetInput} />
          </Form.Item>
        ))}
        <Form.Item label="健康说明">
          <TextArea value={form.healthNote} rows={3} onChange={(healthNote) => updateForm({ healthNote })} />
        </Form.Item>
        <Form.Item label="特殊注意事项">
          <TextArea value={form.remark} rows={3} onChange={(remark) => updateForm({ remark })} />
        </Form.Item>
      </Form>
      <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
        提交审核
      </Button>
      {isOnboarding ? (
        <Button block fill="none" className="onboarding-skip" onClick={() => navigate('/owner', { replace: true })}>
          跳过，以后再说
        </Button>
      ) : null}
      <Picker
        columns={[PET_BREEDS.map((breed) => ({ label: breed.label, value: breed.code }))]}
        visible={breedVisible}
        onClose={() => setBreedVisible(false)}
        value={[form.breed]}
        onConfirm={(value) => updateForm({ breed: value[0] as PetBreedCode })}
      />
    </PageContainer>
  );

  function updateForm(patch: Partial<PetInput>) {
    setForm((current) => ({ ...current, ...patch }));
    if (issue && Object.prototype.hasOwnProperty.call(patch, issue.field)) {
      setIssue(undefined);
    }
  }
}

function FieldIssue({ issue, field }: { issue?: PetFormIssue; field: keyof PetInput }) {
  if (issue?.field !== field) return null;
  return <p className="field-hint field-hint--error">{issue.message}</p>;
}

function validatePetForm(input: PetInput): PetFormIssue | undefined {
  const name = input.petName.trim();
  if (!name) {
    return {
      field: 'petName',
      message: '宠物昵称：还没有填写。请填 1-20 个字，比如“豆豆”。'
    };
  }
  if (name.length > 20) {
    return {
      field: 'petName',
      message: '宠物昵称：名字太长啦。请控制在 20 个字以内。'
    };
  }

  const breed = PET_BREEDS.find((item) => item.code === input.breed);
  if (!breed) {
    return {
      field: 'breed',
      message: '品种：暂不支持这个品种。请选择列表里的小型犬品种。'
    };
  }

  if (![1, 2].includes(input.gender)) {
    return {
      field: 'gender',
      message: '性别：请选择“公”或“母”。'
    };
  }

  if (!Number.isFinite(input.ageMonths) || input.ageMonths < 1 || input.ageMonths > 240) {
    return {
      field: 'ageMonths',
      message: '年龄（月）：请填写 1-240 之间的数字，例如 12 表示 1 岁。'
    };
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return {
      field: 'weightKg',
      message: `体重（kg）：请填写大于 0 的数字。${getBreedWeightHint(input.breed)}`
    };
  }

  if (input.weightKg > breed.maxWeightKg) {
    return {
      field: 'weightKg',
      message: `体重（kg）：${breed.label}当前最多支持 ${breed.maxWeightKg}kg。请填写不超过 ${breed.maxWeightKg}kg，或选择更符合实际的品种。`
    };
  }

  if (input.biteHistory) {
    return {
      field: 'biteHistory',
      message: '是否有咬人史：平台暂不支持有咬人史的犬只。若没有咬人史，请关闭这个开关。'
    };
  }

  if (!input.acceptsStrangers) {
    return {
      field: 'acceptsStrangers',
      message: '是否接受陌生人：平台暂时只服务能接受陌生人的犬只。若宝贝可以接受服务者接近，请打开这个开关。'
    };
  }

  if (!input.leashTrained) {
    return {
      field: 'leashTrained',
      message: '是否有牵引习惯：平台暂时只服务有牵引习惯的犬只。若宝贝能正常牵引出门，请打开这个开关。'
    };
  }

  return undefined;
}

function getPetIssueFromApiError(error: unknown): PetFormIssue | undefined {
  const message = error instanceof Error ? error.message : '';
  if (!message) return undefined;

  if (message.includes('暂不支持该品种')) {
    return { field: 'breed', message: '品种：暂不支持这个品种。请选择列表里的小型犬品种。' };
  }
  if (message.includes('最大支持')) {
    return { field: 'weightKg', message: `体重（kg）：${message}。请按当前品种的体重上限填写，或重新选择品种。` };
  }
  if (message.includes('咬人史')) {
    return { field: 'biteHistory', message: '是否有咬人史：平台暂不支持有咬人史的犬只。若没有咬人史，请关闭这个开关。' };
  }
  if (message.includes('接受陌生人')) {
    return { field: 'acceptsStrangers', message: '是否接受陌生人：平台暂时只服务能接受陌生人的犬只。若宝贝可以接受服务者接近，请打开这个开关。' };
  }
  if (message.includes('牵引习惯')) {
    return { field: 'leashTrained', message: '是否有牵引习惯：平台暂时只服务有牵引习惯的犬只。若宝贝能正常牵引出门，请打开这个开关。' };
  }

  return undefined;
}

function getBreedWeightHint(code: PetBreedCode): string {
  const breed = PET_BREEDS.find((item) => item.code === code);
  return breed ? `${breed.label}当前支持 0-${breed.maxWeightKg}kg。` : '请先选择平台支持的品种。';
}
