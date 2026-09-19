import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Product() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Product</h1>
            <p className="text-muted-foreground">Protected area</p>
          </div>
          <Link to="/">
            <Button variant="outline" size="lg" className="w-full">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
