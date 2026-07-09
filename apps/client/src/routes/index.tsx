import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <PageHeader
        title="Heritage Archives Patrimoine"
        description="Open-source platform for cataloguing and preserving literary and cultural heritage collections."
      />
      <div className="row mt-4">
        <div className="col-md-4">
          <SurfaceCard>
            <div className="card-body">
              <h2 className="card-title">API Status</h2>
              <p className="text-secondary">Check connectivity to the HAP API.</p>
              <Link to="/ping" className="btn btn-primary">
                View status
              </Link>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
