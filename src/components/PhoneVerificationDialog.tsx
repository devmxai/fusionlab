import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Shield, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (phoneNumber: string) => void;
}

const PHONE_LENGTH = 11; // 07xxxxxxxxx

const PhoneVerificationDialog = ({ open, onOpenChange, onVerified }: PhoneVerificationDialogProps) => {
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
      setOtp(["", "", "", ""]);
      setLoading(false);
      setCountdown(0);
    }
  }, [open]);

  const formatPhoneDisplay = (value: string) => {
    // Show placeholder zeros that get replaced
    const digits = value.replace(/\D/g, "");
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= PHONE_LENGTH) {
      setPhone(val);
    }
  };

  const sendOtp = async () => {
    if (phone.length !== PHONE_LENGTH || !phone.startsWith("07")) {
      toast.error("أدخل رقم عراقي صحيح يبدأ بـ 07");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-otp", {
        body: { action: "send_otp", phone_number: phone },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || "فشل الإرسال");
        return;
      }
      toast.success("تم إرسال رمز التحقق عبر WhatsApp");
      setStep("otp");
      setCountdown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 3 : nextEmpty]?.focus();
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 4) {
      toast.error("أدخل الرمز المكوّن من 4 أرقام");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-otp", {
        body: { action: "verify_otp", phone_number: phone, otp_code: code },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || "الرمز غير صحيح");
        if (data.error === "wrong_code") {
          setOtp(["", "", "", ""]);
          otpRefs.current[0]?.focus();
        }
        return;
      }
      setStep("success");
      setTimeout(() => {
        onVerified(phone);
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0) return;
    await sendOtp();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-card border-border/50" dir="rtl">
        <DialogTitle className="sr-only">التحقق من رقم الهاتف</DialogTitle>
        <AnimatePresence mode="wait">
          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="p-6 space-y-5"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Phone className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-base font-bold text-foreground">التحقق من رقم الهاتف</h2>
                <p className="text-xs text-muted-foreground">سنرسل رمز تحقق إلى حسابك على WhatsApp</p>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">رقم الهاتف</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-secondary/50 border border-border/30 rounded-lg px-3 h-11 shrink-0">
                    <span className="text-base leading-none">🇮🇶</span>
                    <span className="text-xs font-mono font-bold text-muted-foreground" dir="ltr">+964</span>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="07XX XXX XXXX"
                      className="text-sm font-mono bg-secondary/30 border-border/30 h-11 tracking-wider"
                      dir="ltr"
                      maxLength={11}
                      autoFocus
                    />
                    {phone.length > 0 && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        {phone.length}/{PHONE_LENGTH}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-11 text-sm font-bold"
                disabled={phone.length !== PHONE_LENGTH || loading}
                onClick={sendOtp}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Shield className="w-4 h-4 ml-2" />
                )}
                {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground/60">
                سيتم إرسال رسالة WhatsApp تحتوي على رمز التحقق
              </p>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="p-6 space-y-5"
            >
              {/* Back button */}
              <button
                onClick={() => setStep("phone")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                تغيير الرقم
              </button>

              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-base font-bold text-foreground">أدخل رمز التحقق</h2>
                <p className="text-xs text-muted-foreground">
                  تم الإرسال إلى <span className="font-mono font-bold text-foreground" dir="ltr">{phone}</span>
                </p>
              </div>

              {/* OTP Inputs */}
              <div className="flex justify-center gap-3" dir="ltr" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-14 h-14 text-center text-xl font-bold rounded-xl border-2 border-border/50 bg-secondary/30 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                ))}
              </div>

              <Button
                className="w-full h-11 text-sm font-bold"
                disabled={otp.some((d) => !d) || loading}
                onClick={verifyOtp}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                )}
                {loading ? "جاري التحقق..." : "تأكيد"}
              </Button>

              {/* Resend */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-[10px] text-muted-foreground">
                    إعادة الإرسال بعد <span className="font-mono font-bold text-primary">{countdown}</span> ثانية
                  </p>
                ) : (
                  <button
                    onClick={resendOtp}
                    className="text-[10px] text-primary hover:underline font-bold"
                    disabled={loading}
                  >
                    إعادة إرسال الرمز
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </motion.div>
              <h2 className="text-base font-bold text-foreground">تم التحقق بنجاح!</h2>
              <p className="text-xs text-muted-foreground">تم ربط رقم هاتفك بحسابك</p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationDialog;
