import { Link } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { Truck } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-[#BE1C2D] rounded-lg flex items-center justify-center mx-auto mb-6">
          <Truck className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-8">Page not found</p>
        <Link to="/">
          <Button className="bg-[#BE1C2D] hover:bg-[#A81828] text-white">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
