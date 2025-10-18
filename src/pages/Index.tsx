import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Database, FileText, Shield, TrendingUp, Zap } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Tax Position Automation System
            </h1>
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Streamline tax position management with automated data processing, intelligent analysis, and audit-grade reporting
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="text-lg">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="text-lg">
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Powerful Features for Tax Professionals
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to process, analyze, and report tax positions with confidence
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Database className="mb-2 h-10 w-10 text-primary" />
              <CardTitle>Data Import & Processing</CardTitle>
              <CardDescription>
                Multi-format data import with automatic parsing, validation, and normalization from TRA sources
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Zap className="mb-2 h-10 w-10 text-accent" />
              <CardTitle>Automated Data Cleaning</CardTitle>
              <CardDescription>
                Intelligent standardization, duplicate detection, and date format unification with stable row tracking
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <TrendingUp className="mb-2 h-10 w-10 text-primary" />
              <CardTitle>Advanced Analysis</CardTitle>
              <CardDescription>
                Group separation, total calculations, and intelligent entry removal with negative arrears detection
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <FileText className="mb-2 h-10 w-10 text-accent" />
              <CardTitle>Tax Position Calculations</CardTitle>
              <CardDescription>
                Automated arrears computation with tax type categorization and real-time summary generation
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Shield className="mb-2 h-10 w-10 text-primary" />
              <CardTitle>Audit & Compliance</CardTitle>
              <CardDescription>
                Complete action logging, reversible operations, and data integrity verification with audit trails
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <CheckCircle className="mb-2 h-10 w-10 text-accent" />
              <CardTitle>Professional Reporting</CardTitle>
              <CardDescription>
                Print-optimized layouts, Excel/PDF exports, and Demand Note integration with exact formatting
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-y border-border bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Built for Tax Professionals
            </h2>
            <p className="text-lg text-muted-foreground">
              Designed specifically for tax consultants, compliance officers, and financial analysts
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-primary/10 p-3">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Eliminate Manual Errors</h3>
              <p className="text-muted-foreground">
                Automated processing eliminates human error and ensures accuracy in tax position calculations
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-accent/10 p-3">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Save Time</h3>
              <p className="text-muted-foreground">
                Process large volumes of tax data in minutes instead of hours with intelligent automation
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-primary/10 p-3">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Audit-Grade Quality</h3>
              <p className="text-muted-foreground">
                Complete audit trails and reversible operations ensure compliance and data integrity
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-accent/10 p-3">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Smart Detection</h3>
              <p className="text-muted-foreground">
                Intelligent algorithms detect discrepancies, duplicates, and negative arrears automatically
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-primary/10 p-3">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Professional Output</h3>
              <p className="text-muted-foreground">
                Generate print-ready reports and exports that match exact formatting requirements
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 rounded-lg bg-accent/10 p-3">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Data Security</h3>
              <p className="text-muted-foreground">
                Passcode-protected access with local storage encryption keeps sensitive tax data secure
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Ready to Transform Your Tax Position Management?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join tax professionals who trust our system for accurate, efficient, and compliant tax position processing
            </p>
            <Button size="lg" className="text-lg">
              Start Your Free Trial
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Tax Position Automation System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
