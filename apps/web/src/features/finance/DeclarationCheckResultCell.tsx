import { Tooltip } from 'antd';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import type { DeclarationCheckResultPresentation } from './declarationCheckResultModel';

type DeclarationCheckResultCellProps = DeclarationCheckResultPresentation & {
  tag?: {
    tone: StatusTagTone;
    value: string;
  };
};

function ResultText({ className, text, tooltipThreshold }: { className: string; text: string; tooltipThreshold: number }) {
  const content = <span className={className}>{text}</span>;

  return text.length > tooltipThreshold ? <Tooltip title={text}>{content}</Tooltip> : content;
}

export function DeclarationCheckResultCell({ detail, summary, tag }: DeclarationCheckResultCellProps) {
  return (
    <div className="declaration-check-result">
      <div className="declaration-check-result-summary-row">
        <ResultText className="declaration-check-result-summary" text={summary} tooltipThreshold={18} />
        {tag ? (
          <span className="declaration-check-result-tag">
            <StatusTag tone={tag.tone} value={tag.value} />
          </span>
        ) : null}
      </div>
      {detail ? (
        <ResultText className="declaration-check-result-detail" text={detail} tooltipThreshold={30} />
      ) : null}
    </div>
  );
}
