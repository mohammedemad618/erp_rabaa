import type { EmployeeGrade, TravelClass, TripType } from "@/modules/travel/types";
import { type TravelPolicyConfig, DEFAULT_TRAVEL_POLICY } from "./travel-policy-engine";

export interface PolicyRecommendationInput {
  employeeGrade?: EmployeeGrade;
  tripType?: TripType;
  departureDate?: string;
  estimatedCost?: number;
  now?: Date;
}

export interface PolicyRecommendation {
  type: "info" | "warning" | "success" | "danger";
  title: string;
  message: string;
  actionable?: string;
}

const CLASS_LABELS: Record<TravelClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First Class",
};

export function getPolicyRecommendations(
  input: PolicyRecommendationInput,
  policy: TravelPolicyConfig = DEFAULT_TRAVEL_POLICY,
  locale: string = "en",
): PolicyRecommendation[] {
  const recommendations: PolicyRecommendation[] = [];
  const now = input.now ?? new Date();

  const isAr = locale === "ar";

  // 1. Employee Grade & Travel Class
  if (input.employeeGrade) {
    const maxClass = policy.maxTravelClassByGrade[input.employeeGrade];
    const maxBudget = policy.maxBudgetByGrade[input.employeeGrade];

    recommendations.push({
      type: "info",
      title: isAr ? "فئة السفر المسموحة" : "Allowed Travel Class",
      message: isAr
        ? `بناءً على درجتك الوظيفية، الحد الأقصى المسموح لك هو تذاكر فئة "${CLASS_LABELS[maxClass] || maxClass}".`
        : `Based on your grade, your maximum allowed travel class is "${CLASS_LABELS[maxClass] || maxClass}".`,
      actionable: maxClass
    });

    if (input.estimatedCost !== undefined && input.estimatedCost > 0) {
      const budgetRatio = input.estimatedCost / maxBudget;
      if (budgetRatio > 1) {
        recommendations.push({
          type: "danger",
          title: isAr ? "تجاوز الميزانية" : "Budget Exceeded",
          message: isAr
            ? `التكلفة المقدرة تتجاوز الحد الأقصى (${maxBudget}) الخاص بدرجتك.`
            : `Estimated cost exceeds your grade's maximum budget (${maxBudget}).`,
          actionable: isAr ? "يُرجى اختيار خيارات أقل تكلفة لتجنب الرفض." : "Please select lower-cost options to avoid rejection.",
        });
      } else if (budgetRatio >= policy.budgetWarningThreshold) {
        recommendations.push({
          type: "warning",
          title: isAr ? "الاقتراب من سقف الميزانية" : "Approaching Budget Cap",
          message: isAr
            ? `لقد استهلكت أكثر من ${Math.round(policy.budgetWarningThreshold * 100)}% من الحد الأقصى للميزانية المخصصة لك.`
            : `You have consumed more than ${Math.round(policy.budgetWarningThreshold * 100)}% of your allocated budget cap.`,
        });
      } else {
        recommendations.push({
          type: "success",
          title: isAr ? "الميزانية ضمن النطاق المسموح" : "Budget within limits",
          message: isAr
            ? `التكلفة المقدرة ضمن الحدود المعقولة للسياسة وسريعة الاعتماد.`
            : `Estimated cost is well within policy limits and likely to be auto-approved.`,
        });
      }
    } else {
      recommendations.push({
        type: "info",
        title: isAr ? "إرشادات الميزانية" : "Budget Guidelines",
        message: isAr
          ? `الحد الأقصى المسموح للرحلة هو ${maxBudget}. حاول البقاء ضمن هذا النطاق لضمان الموافقة السريعة.`
          : `Your maximum allowed trip budget is ${maxBudget}. Try to stay within this limit for quick approval.`,
      });
    }
  }

  // 2. Advance Booking Days
  if (input.tripType) {
    const minAdvanceDays = policy.minAdvanceDaysByTripType[input.tripType];

    if (input.departureDate) {
      const departure = new Date(input.departureDate);
      if (!Number.isNaN(departure.getTime())) {
        const copy = new Date(now);
        copy.setHours(0, 0, 0, 0);
        const depCopy = new Date(departure);
        depCopy.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((depCopy.getTime() - copy.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff < minAdvanceDays) {
          recommendations.push({
            type: "danger",
            title: isAr ? "مخالفة الحجز المبكر" : "Advance Booking Violation",
            message: isAr
              ? `تتطلب رحلات نوع (${input.tripType}) الحجز قبل ${minAdvanceDays} أيام على الأقل.`
              : `Trips of type (${input.tripType}) require at least ${minAdvanceDays} days advance booking.`,
            actionable: isAr ? `يرجى تأخير تاريخ المغادرة إلى ما بعد ${minAdvanceDays} أيام لتجنب الرفض.` : `Please delay departure date beyond ${minAdvanceDays} days to avoid rejection.`,
          });
        } else {
          recommendations.push({
            type: "success",
            title: isAr ? "توقيت الحجز ممتاز" : "Excellent Booking Timing",
            message: isAr
              ? `لقد استوفيت متطلبات الحجز المبكر (باقي ${daysDiff} أيام).`
              : `You have met the advance booking requirements (${daysDiff} days ahead).`,
          });
        }
      }
    } else {
      const earliestValidDate = new Date(now);
      earliestValidDate.setDate(earliestValidDate.getDate() + minAdvanceDays);
      recommendations.push({
        type: "info",
        title: isAr ? "متطلبات الحجز المبكر" : "Advance Booking Rules",
        message: isAr
          ? `يرجى العلم أن هذا النوع من الرحلات يتطلب الحجز المسبق بفترة لا تقل عن ${minAdvanceDays} أيام لتفادي الاستثناءات.`
          : `Please note this trip type requires booking at least ${minAdvanceDays} days in advance to avoid exceptions.`,
        actionable: isAr
          ? `أقرب تاريخ مبدئي مسموح به هو: ${earliestValidDate.toLocaleDateString('en-CA')}`
          : `Earliest compliant departure date is: ${earliestValidDate.toLocaleDateString('en-CA')}`,
      });
    }
  }

  return recommendations;
}
