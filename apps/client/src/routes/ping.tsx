import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../lib/httpClient';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';

export const Route = createFileRoute('/ping')({
  component: PingPage,
});

interface PingResponse {
  status: string;
  service: string;
  version: string;
}

function PingPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['ping'],
    queryFn: () => httpClient.get<PingResponse>('/ping'),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <PageHeader title="API Status" />
      <div className="col-md-5">
        <SurfaceCard className={isError ? 'border-danger' : isPending ? '' : 'border-success'}>
          <div className="card-body">
            {isPending && (
              <div className="d-flex align-items-center gap-2 text-secondary">
                <div className="spinner-border spinner-border-sm" role="status" />
                <span>Connecting…</span>
              </div>
            )}
            {isError && (
              <div className="text-danger">
                <strong>Unreachable</strong>
                <div className="text-secondary small mt-1">{String(error)}</div>
              </div>
            )}
            {data && (
              <dl className="row mb-0">
                <dt className="col-4">Status</dt>
                <dd className="col-8">
                  <span className="badge bg-success">{data.status}</span>
                </dd>
                <dt className="col-4">Service</dt>
                <dd className="col-8">{data.service}</dd>
                <dt className="col-4">Version</dt>
                <dd className="col-8">v{data.version}</dd>
              </dl>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
