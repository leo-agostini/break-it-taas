import { TestCaseForm } from '@/features/test-cases/components/test-case-form';
import { useCreateTestCase } from '@/features/test-cases/hooks/use-create-test-case';
import { toNewTestCaseInput } from '@/features/test-cases/mappers/new-test-case-mapper';
import type { NewTestCaseFormValues } from '@/features/test-cases/schemas/new-test-case-schema';
import type { TestCaseOwnerType } from '@/features/test-cases/types/test-case';
import { getApiErrorMessage } from '@/lib/api-error';
import { currentUserAtom } from '@/state/current-user-atom';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRecoilValue } from 'recoil';
import { toast } from 'sonner';

export function TestCaseFormContainer() {
  const currentUser = useRecoilValue(currentUserAtom);
  const navigate = useNavigate();
  const { createTestCase, isCreating } = useCreateTestCase();
  const [ownerType, setOwnerType] = useState<TestCaseOwnerType>('USER');
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(values: NewTestCaseFormValues) {
    if (!currentUser) {
      setSubmitError('Your session could not be read. Please sign in again.');
      return;
    }

    const ownerId =
      ownerType === 'ORGANIZATION' ? currentUser.orgId : currentUser.id;

    if (!ownerId) {
      setSubmitError('You do not belong to an organization.');
      return;
    }

    setSubmitError(null);

    try {
      const result = await createTestCase(
        toNewTestCaseInput(values, { ownerType, ownerId }),
      );
      toast.success('Test case created. First run queued.');
      navigate(`/test-cases/${result.testCaseId}`);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Could not create test case.');
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <TestCaseForm
      canSelectOrganization={!!currentUser?.orgId}
      ownerType={ownerType}
      onOwnerTypeChange={setOwnerType}
      isSubmitting={isCreating}
      submitError={submitError}
      onSubmit={handleSubmit}
    />
  );
}
