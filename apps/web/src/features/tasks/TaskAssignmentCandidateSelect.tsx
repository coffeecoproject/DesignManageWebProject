import { Drawer, Empty, Input, Segmented } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, StatusTag, type StatusTagTone } from '../../components/Detail';
import { TagChip } from '../../components/TagChip';
import type { TaskAssignmentCandidate } from './taskAssignmentCandidates';

type CandidateFilter = '可选' | '不可选' | '全部';

type TaskAssignmentCandidatePickerProps = {
  candidates: TaskAssignmentCandidate[];
  disabled?: boolean;
  disabledReason?: string;
  onChange: (memberId: string) => void;
  placeholder: string;
  title: string;
  value: string;
};

const candidateKindTone: Record<TaskAssignmentCandidate['kind'], StatusTagTone> = {
  推荐: 'green',
  可选: 'blue',
  不可选: 'gray'
};

function getCandidateReason(candidate: TaskAssignmentCandidate) {
  if (candidate.blockers.length > 0) {
    return candidate.blockers.join('；');
  }

  if (candidate.reasons.length > 0) {
    return candidate.reasons.slice(0, 3).join('；');
  }

  return '当前可分配';
}

function getPrimaryCandidateReason(candidate: TaskAssignmentCandidate) {
  return candidate.blockers[0] ?? candidate.reasons[0] ?? '当前可分配';
}

function getExtraCandidateReasonCount(candidate: TaskAssignmentCandidate) {
  const reasons = candidate.blockers.length > 0 ? candidate.blockers : candidate.reasons;

  return Math.max(reasons.length - 1, 0);
}

function getCandidateReasonTitle(candidate: TaskAssignmentCandidate) {
  const reasons = candidate.blockers.length > 0 ? candidate.blockers : candidate.reasons;

  return reasons.length > 0 ? reasons.join('；') : '当前可分配';
}

function getCandidateSearchText(candidate: TaskAssignmentCandidate) {
  return [
    candidate.member.name,
    candidate.member.id,
    candidate.member.mobile,
    candidate.member.position,
    candidate.member.personnelType,
    candidate.member.status
  ]
    .join(' ')
    .toLowerCase();
}

function CandidateReasonTags({ candidate }: { candidate: TaskAssignmentCandidate }) {
  const hasBlocker = candidate.blockers.length > 0;
  const hasReason = candidate.reasons.length > 0;
  const extraReasonCount = getExtraCandidateReasonCount(candidate);
  const primaryTone = hasBlocker ? 'red' : hasReason ? 'amber' : 'green';
  const label = hasBlocker ? '不可选' : hasReason ? '提示' : '匹配';

  return (
    <span className="task-candidate-reason-line" title={getCandidateReasonTitle(candidate)}>
      <span className="task-candidate-reason-label">{label}</span>
      <TagChip label={getPrimaryCandidateReason(candidate)} tone={primaryTone} />
      {extraReasonCount > 0 ? <TagChip label={`+${extraReasonCount}`} tone="gray" /> : null}
    </span>
  );
}

function CandidateCard({
  candidate,
  selected,
  onSelect
}: {
  candidate: TaskAssignmentCandidate;
  onSelect: (memberId: string) => void;
  selected: boolean;
}) {
  return (
    <button
      className={`task-candidate-card ${selected ? 'task-candidate-card-selected' : ''} ${candidate.selectable ? '' : 'task-candidate-card-disabled'}`}
      disabled={!candidate.selectable}
      type="button"
      onClick={() => onSelect(candidate.member.id)}
    >
      <div className="task-candidate-card-head">
        <div className="task-candidate-card-person">
          <span className="task-candidate-name">{candidate.member.name}</span>
          <span className="task-candidate-meta">{candidate.member.position} / {candidate.member.personnelType} / {candidate.member.status}</span>
        </div>
        <StatusTag toneMap={candidateKindTone} value={candidate.kind} />
      </div>
      <div className="task-candidate-card-row">
        <div className="task-candidate-card-metrics">
          <span>进行中 {candidate.currentTaskCount} 个</span>
          <span>绩效 {candidate.performanceScore} 分</span>
        </div>
        <div className={candidate.selectable ? 'task-candidate-reason' : 'task-candidate-blocker'}>
          <CandidateReasonTags candidate={candidate} />
        </div>
      </div>
    </button>
  );
}

export function TaskAssignmentCandidatePicker({
  candidates,
  disabled = false,
  disabledReason,
  onChange,
  placeholder,
  title,
  value
}: TaskAssignmentCandidatePickerProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<CandidateFilter>('可选');
  const selectedCandidate = candidates.find((candidate) => candidate.member.id === value);
  const selectableCount = candidates.filter((candidate) => candidate.selectable).length;
  const unavailableCount = candidates.length - selectableCount;
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        if (filter === '可选' && !candidate.selectable) {
          return false;
        }

        if (filter === '不可选' && candidate.selectable) {
          return false;
        }

        return !normalizedKeyword || getCandidateSearchText(candidate).includes(normalizedKeyword);
      }),
    [candidates, filter, normalizedKeyword]
  );

  function handleOpen() {
    if (disabled) {
      return;
    }

    setFilter(selectableCount > 0 ? '可选' : '不可选');
    setOpen(true);
  }

  function handleSelect(memberId: string) {
    onChange(memberId);
    setOpen(false);
  }

  return (
    <>
      <div className={`task-assignee-field ${disabled ? 'task-assignee-field-disabled' : ''}`}>
        <button className="task-assignee-value" disabled={disabled} type="button" onClick={handleOpen}>
          {selectedCandidate ? (
            <>
              <span className="task-assignee-name">{selectedCandidate.member.name}</span>
              <span className="task-assignee-meta">{selectedCandidate.member.position} / {selectedCandidate.kind}</span>
            </>
          ) : (
            <span className="task-assignee-placeholder">{placeholder}</span>
          )}
        </button>
      </div>
      {disabled && disabledReason ? <div className="task-assignee-helper">{disabledReason}</div> : null}

      <Drawer
        className="task-candidate-drawer"
        destroyOnHidden
        open={open}
        title={<DetailDrawerTitle subtitle={`可选 ${selectableCount} 人 / 不可选 ${unavailableCount} 人`} title={title} />}
        width={620}
        onClose={() => setOpen(false)}
      >
        <div className="task-candidate-drawer-tools">
          <Input allowClear placeholder="搜索姓名、手机号、岗位" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Segmented<CandidateFilter>
            options={[
              { label: `可选 ${selectableCount}`, value: '可选' },
              { label: `不可选 ${unavailableCount}`, value: '不可选' },
              { label: `全部 ${candidates.length}`, value: '全部' }
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>

        <div className="task-candidate-list">
          {filteredCandidates.length > 0 ? (
            filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.member.id} candidate={candidate} selected={candidate.member.id === value} onSelect={handleSelect} />
            ))
          ) : (
            <Empty description="没有匹配人员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </Drawer>
    </>
  );
}

export function TaskAssignmentCandidateNotice({ candidate, emptyMessage }: { candidate: TaskAssignmentCandidate | undefined; emptyMessage: string }) {
  if (!candidate) {
    return <TagChip label={emptyMessage} tone="amber" />;
  }

  return <TagChip label={getCandidateReason(candidate)} tone={candidate.selectable ? 'blue' : 'gray'} />;
}
