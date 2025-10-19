import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, Shield } from "lucide-react";
import {
  validatePasscode,
  createSession,
  getSession,
  checkInactivity,
  isDeviceLocked,
  getRemainingLockoutTime,
  generateDeviceFingerprint,
  storeDeviceFingerprint,
} from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    // Check if already authenticated
    const session = getSession();
    if (session && !checkInactivity()) {
      navigate("/dashboard");
      return;
    }

    // Check if device is locked
    if (isDeviceLocked()) {
      setIsLocked(true);
      const remaining = getRemainingLockoutTime();
      setLockoutTime(Math.ceil(remaining / 1000));
    }
  }, [navigate]);

  useEffect(() => {
    if (isLocked && lockoutTime > 0) {
      const timer = setInterval(() => {
        const remaining = getRemainingLockoutTime();
        if (remaining <= 0) {
          setIsLocked(false);
          setLockoutTime(0);
          setError("");
        } else {
          setLockoutTime(Math.ceil(remaining / 1000));
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isLocked, lockoutTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError(`Device is locked. Please wait ${lockoutTime} seconds.`);
      return;
    }

    const result = validatePasscode(passcode);
    
    if (result.success) {
      createSession();
      const fingerprint = generateDeviceFingerprint();
      storeDeviceFingerprint(fingerprint);
      toast({
        title: "Access Granted",
        description: "Welcome to Tax Position Automation System",
      });
      navigate("/dashboard");
    } else {
      setError(result.error || "Invalid passcode");
      setPasscode("");
      
      if (result.locked) {
        setIsLocked(true);
        const remaining = getRemainingLockoutTime();
        setLockoutTime(Math.ceil(remaining / 1000));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Tax Position System</CardTitle>
          <CardDescription className="text-center">
            Enter your passcode to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  disabled={isLocked}
                  className="pl-10"
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLocked && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Too many failed attempts. Please wait {lockoutTime} seconds before trying again.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLocked || !passcode}>
              {isLocked ? `Locked (${lockoutTime}s)` : "Access System"}
            </Button>

            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>• This system uses device fingerprinting for security</p>
              <p>• Maximum 3 attempts before 5-minute lockout</p>
              <p>• Session expires after 10 minutes of inactivity</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
