/**
 * @vitest-environment jsdom
 */
import {
  BranchExecutionType,
  FlowActionType,
  RouterAction,
  RouterExecutionType,
} from '@activepieces/shared';
import { fireEvent, render, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { BranchesList } from '@/app/builder/step-settings/router-settings/branches-list';

const buildRouterStep = (conditionBranchNames: string[]): RouterAction => ({
  name: 'step_1',
  valid: true,
  displayName: 'Router',
  lastUpdatedDate: new Date().toISOString(),
  type: FlowActionType.ROUTER,
  children: [...conditionBranchNames.map(() => null), null],
  settings: {
    executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
    branches: [
      ...conditionBranchNames.map((branchName) => ({
        branchType: BranchExecutionType.CONDITION as const,
        branchName,
        conditions: [],
      })),
      {
        branchType: BranchExecutionType.FALLBACK as const,
        branchName: 'Otherwise',
      },
    ],
  },
});

const renderBranchesList = ({
  conditionBranchNames,
  branchNameChanged = () => {},
}: {
  conditionBranchNames: string[];
  branchNameChanged?: (index: number, name: string) => void;
}) => {
  const step = buildRouterStep(conditionBranchNames);
  const Harness = () => {
    const form = useForm<RouterAction>({ defaultValues: step });
    return (
      <FormProvider {...form}>
        <BranchesList
          step={step}
          errors={[]}
          readonly={false}
          setSelectedBranchIndex={() => {}}
          deleteBranch={() => {}}
          duplicateBranch={() => {}}
          branchNameChanged={branchNameChanged}
          moveBranch={() => {}}
        />
      </FormProvider>
    );
  };
  return render(<Harness />);
};

const findRowByBranchName = (container: HTMLElement, branchName: string) => {
  const rows = Array.from(
    container.querySelectorAll<HTMLElement>('div.button-group'),
  ).map((buttonGroup) => buttonGroup.parentElement);
  const row = rows.find((candidate) =>
    candidate?.textContent?.startsWith(branchName),
  );
  if (!row) {
    throw new Error(`no branch row rendered for "${branchName}"`);
  }
  return row;
};

const iconNames = (row: HTMLElement) =>
  Array.from(row.querySelectorAll('div.button-group svg')).map((icon) =>
    Array.from(icon.classList).find(
      (className) =>
        className.startsWith('lucide-') && className !== 'lucide-icon',
    ),
  );

describe('router branches list', () => {
  it('renders the fallback branch last so it can be reached at all', () => {
    const { container } = renderBranchesList({
      conditionBranchNames: ['Alpha', 'Beta'],
    });

    const branchNames = Array.from(
      container.querySelectorAll<HTMLElement>('div.button-group'),
    ).map((buttonGroup) => buttonGroup.parentElement?.textContent);

    expect(branchNames).toEqual(['Alpha', 'Beta', 'Otherwise']);
  });

  it('offers rename and nothing else on the fallback branch', () => {
    const { container } = renderBranchesList({
      conditionBranchNames: ['Alpha', 'Beta'],
    });

    expect(iconNames(findRowByBranchName(container, 'Otherwise'))).toEqual([
      'lucide-pencil',
    ]);
  });

  it('leaves condition branches their delete, duplicate and drag actions', () => {
    const { container } = renderBranchesList({
      conditionBranchNames: ['Alpha', 'Beta'],
    });

    expect(iconNames(findRowByBranchName(container, 'Alpha'))).toEqual([
      'lucide-trash',
      'lucide-pencil',
      'lucide-copy-plus',
      'lucide-grip-vertical',
    ]);
  });

  it('reports a renamed fallback branch against its own index', () => {
    const branchNameChanged = vi.fn();
    const { container } = renderBranchesList({
      conditionBranchNames: ['Alpha', 'Beta'],
      branchNameChanged,
    });

    const fallbackRow = findRowByBranchName(container, 'Otherwise');
    fireEvent.click(within(fallbackRow).getByRole('button'));

    const editableName = fallbackRow.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (!editableName) {
      throw new Error('clicking rename did not open the fallback name editor');
    }
    editableName.textContent = 'No match';
    fireEvent.keyDown(editableName, { key: 'Enter' });

    expect(branchNameChanged).toHaveBeenCalledWith(2, 'No match');
  });

  it('does not make the fallback row itself open the branch conditions editor', () => {
    const { container } = renderBranchesList({
      conditionBranchNames: ['Alpha', 'Beta'],
    });

    expect(findRowByBranchName(container, 'Otherwise').className).toContain(
      'cursor-default',
    );
    expect(findRowByBranchName(container, 'Alpha').className).toContain(
      'cursor-pointer',
    );
  });
});
