import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="page-header">
      <div className="row align-items-center">
        <div className="col-auto">
          <h1 className="page-title">Heritage Archives Patrimoine</h1>
          <p className="text-secondary mt-1">
            Open-source platform for cataloguing and preserving literary and cultural heritage
            collections.
          </p>
        </div>
      </div>
      <div className="row mt-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title">API Status</h3>
              <p className="text-secondary">Check connectivity to the HAP API.</p>
              <Link to="/ping" className="btn btn-primary">
                View status
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
