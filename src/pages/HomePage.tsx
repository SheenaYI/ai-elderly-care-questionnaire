import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  HeartHandshake,
  MonitorPlay,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  Clock3,
  UserRound,
  FileCheck2,
  LockKeyhole,
} from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import HeroOrbit from "@/components/home/HeroOrbit";
import { ButtonLink } from "@/components/ui/Button";
import { dataModeNotice } from "@/lib/config";

const FLOW = [
  { icon: UserRound, title: "选择身份" },
  { icon: MonitorPlay, title: "了解情景" },
  { icon: ClipboardCheck, title: "选择与评价" },
  { icon: FileCheck2, title: "匿名提交" },
] as const;

export default function HomePage() {
  const modeNotice = dataModeNotice();
  return (
    <PageContainer size="wide">
      <section className="overflow-hidden rounded-feature border border-sage-200 bg-gradient-to-br from-cream-100 via-cream-50 to-sage-50">
        <div className="grid items-center gap-7 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold leading-[1.25] text-forest-800 sm:text-[2.5rem]">
              当 AI 走进养老生活
            </h1>
            <p className="mt-5 text-xl leading-9 text-forest-700">
              安全、隐私与自主性之间，
              <br />
              您会如何选择？
            </p>
            <p className="mt-4 text-lg leading-8 text-sage-800">
              一份关于智能养老监测的匿名问卷。
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div>
                <ButtonLink
                  to="/questionnaire/elder"
                  size="lg"
                  className="w-full whitespace-nowrap"
                >
                  老人本人版
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </ButtonLink>
                <p className="mt-2 text-base leading-7 text-sage-800">
                  60周岁及以上，由老人本人作答
                </p>
              </div>
              <div>
                <ButtonLink
                  to="/questionnaire/caregiver"
                  variant="secondary"
                  size="lg"
                  className="w-full whitespace-nowrap"
                >
                  家庭照护者版
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </ButtonLink>
                <p className="mt-2 text-base leading-7 text-sage-800">
                  有实际照护老人经历的家庭成员
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 justify-center lg:justify-end">
            <HeroOrbit />
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-7 gap-y-3 border-t border-sage-200 px-6 py-5 text-base text-forest-800 sm:px-10">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            仅用于学术研究
          </li>
          <li className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            匿名填写
          </li>
          <li className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            自愿参与，可随时退出
          </li>
        </ul>
      </section>
      {modeNotice.mode === "demo" && (
        <p
          role="status"
          className="mt-5 flex items-start gap-3 rounded-panel bg-champagne-50 p-4 text-base leading-7 text-champagne-800"
        >
          <TriangleAlert className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo 模式：</strong>未配置
            Supabase，仅供本地试填，不上传答卷。请勿收集正式调查数据。
          </span>
        </p>
      )}
      <section className="mt-10" aria-labelledby="home-about-title">
        <h2
          id="home-about-title"
          className="text-2xl font-semibold text-forest-800"
        >
          三个设置，您的选择
        </h2>
        <p className="mt-3 text-lg leading-8 text-sage-800">
          所有方案的基础异常识别与报警能力相同。
        </p>
        <div className="mt-5 flex flex-col divide-y divide-sage-200 border-y border-sage-200 sm:flex-row sm:divide-x sm:divide-y-0">
          {[
            { icon: Eye, title: "看多细", detail: "信息的详细程度" },
            { icon: UsersRound, title: "发给谁", detail: "信息的接收对象" },
            { icon: Clock3, title: "何时记录", detail: "详细记录的启动时机" },
          ].map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="flex min-w-0 flex-1 items-center gap-4 px-3 py-6 sm:px-5"
            >
              <Icon
                className="h-9 w-9 shrink-0 text-forest-700"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-xl font-semibold text-forest-800">
                  {title}
                </h3>
                <p className="mt-1 text-base text-sage-800">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-10" aria-labelledby="home-flow-title">
        <h2
          id="home-flow-title"
          className="text-2xl font-semibold text-forest-800"
        >
          如何参与
        </h2>
        <ol className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4">
          {FLOW.map(({ icon: Icon, title }, i) => (
            <li
              key={title}
              className="relative flex flex-col items-center gap-3 text-center text-lg font-semibold text-forest-800"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-panel bg-forest-50">
                <Icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <span>{title}</span>
              {i < FLOW.length - 1 && (
                <ArrowRight
                  className={`absolute right-0 top-4 h-5 w-5 text-sage-700 ${i === 1 ? "hidden sm:block" : ""}`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </section>
      <section
        className="mt-10 flex flex-col gap-4 border-t border-sage-200 pt-6 sm:flex-row sm:items-center sm:justify-between"
        aria-label="研究告知"
      >
        <p className="max-w-xl text-base leading-7 text-sage-800">
          仅为研究情景模拟，不会开启您的摄像头，也不收集影像或姓名、联系方式。
        </p>
        <Link
          to="/privacy"
          className="inline-flex min-h-12 shrink-0 items-center gap-2 text-base font-semibold text-forest-800 underline underline-offset-4"
        >
          隐私与知情同意
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </PageContainer>
  );
}
