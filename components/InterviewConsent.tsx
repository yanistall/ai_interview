import React, { useState } from 'react';
import { FileCheck2 } from 'lucide-react';

interface InterviewConsentProps {
  onAgree: () => void;
  onCancel: () => void;
}

const InterviewConsent: React.FC<InterviewConsentProps> = ({ onAgree, onCancel }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="h-full overflow-y-auto bg-noir-950 px-4 pb-10 pt-24 sm:px-6">
      <section aria-labelledby="consent-title" className="mx-auto max-w-3xl rounded-2xl border border-noir-700/50 bg-noir-900 p-6 sm:p-10">
        <FileCheck2 aria-hidden="true" className="mb-5 text-amber-400" size={32} />
        <h1 id="consent-title" className="text-2xl font-bold text-noir-50 sm:text-3xl">資料蒐集與處理授權同意書</h1>
        <p className="mt-3 leading-relaxed text-noir-200"><strong>適用系統：識相 Shikiso：AI Interview 自動化面試官</strong></p>
        <p className="mt-3 leading-relaxed text-noir-200">歡迎使用「識相 Shikiso：AI Interview 自動化面試官」（以下簡稱「本系統」）。本系統提供 AI 面試互動、面試紀錄、能力分析與招募評估輔助服務。為保障您的個人資料及自主選擇權，請在開始面試前詳閱以下事項。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本同意僅限於本文件明確告知的目的及範圍，不構成概括或無期限授權，也不代表您放棄依法享有的權利。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">一、資料蒐集單位與聯絡方式</h2>
        <p className="mt-3 leading-relaxed text-noir-200">本系統之資料蒐集及管理單位為<strong>識相 Shikiso</strong>（以下簡稱「本單位」）。</p>
        <p className="mt-3 leading-relaxed text-noir-200">聯絡電子郵件或線上申請網址：334488556a@gmail.com</p>
        <p className="mt-3 leading-relaxed text-noir-200">如您參與企業招募面試，資料接收企業為該次職缺所標示之招募單位。該企業與本單位在個人資料處理上的角色、責任及聯絡方式，應於面試前提供您查閱。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">二、資料蒐集目的</h2>
        <p className="mt-3 leading-relaxed text-noir-200">本單位於您選擇的服務範圍內，為下列目的蒐集、處理與利用資料：</p>
        <ol className="my-4 list-decimal space-y-2 pl-6 leading-relaxed text-noir-200"><li>執行 AI 面試對話、依回答內容提出延伸問題，並完成面試紀錄。</li><li>製作逐字稿、能力分析、評分報告及逐題改進建議。</li><li>提供您查閱個人面試紀錄、回顧表現及進行面試練習。</li><li>如您參與企業招募，提供該次職缺之授權招募人員進行人工評估與複查。</li><li>處理與本次服務相關的資料更正、刪除、申訴及人工複核申請。</li></ol>
        <p className="mt-3 leading-relaxed text-noir-200">本次授權不包含廣告行銷、對外公開、出售個人資料、其他職缺人才庫招募或 AI 模型訓練等獨立用途。若有新增用途，應另行告知，並於依法需要時另行取得您的同意。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">三、資料類別與蒐集方式</h2>
        <p className="mt-3 leading-relaxed text-noir-200">本系統依實際使用功能，處理下列資料：</p>
        <ol className="my-4 list-decimal space-y-2 pl-6 leading-relaxed text-noir-200"><li>基本及履歷資料：您提供的姓名、電子郵件、聯絡資訊，以及履歷中的學經歷、專業技能與工作經驗。</li><li>面試影音資料：面試期間透過麥克風與攝影機取得的聲音及影像。</li><li>面試內容與紀錄：題目、回答、對話逐字稿、時間標記及所應徵職缺。</li><li>分析結果：回答品質、溝通表達、專業深度、職位適配度、改進建議及評分報告。</li></ol>
        <p className="mt-3 leading-relaxed text-noir-200">影音錄製及逐字稿產生，應於您同意並啟動面試後開始，於面試結束時停止。</p>
        <p className="mt-3 leading-relaxed text-noir-200">請勿提供與面試或職務能力無關或其他受特別保護的資料。本同意書不概括授權處理這些資料，也不授權將影音用於身分辨識、人格或情緒推論。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本文件針對面試服務的資料處理；帳號註冊或履歷上傳時已蒐集的資料，仍應於原蒐集時完成相應告知，不以本次同意追溯取代。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">四、資料保存期間與刪除</h2>
        <p className="mt-3 leading-relaxed text-noir-200">依本系統的資料保存政策：</p>
        <ol className="my-4 list-decimal space-y-2 pl-6 leading-relaxed text-noir-200"><li>面試影片：預設保存 90 天，期滿後自動永久刪除，保存期限起算點為該次面試錄影影片的時間為準。</li><li>逐字稿與評分報告：保存至帳號註銷後 30 天，作為申訴處理緩衝期間，期滿後刪除。</li><li>基本資料、履歷及其他紀錄：保存至帳號註銷後 30 天，作為申訴處理緩衝期間，期滿後刪除。</li><li>主動刪除：您可透過帳號設定頁面申請刪除特定面試紀錄或全部資料；依本系統政策，應於收到有效申請後 72 小時內完成刪除並通知您。</li></ol>
        <p className="mt-3 leading-relaxed text-noir-200">若依法必須保留部分資料，本單位應說明保留依據、範圍及期間，並限制其用途。上述自助刪除涵蓋本系統資料庫與影片儲存；備份及受託服務商副本的保存與刪除期限，應依實際部署與服務條款另行告知。</p>
        <p className="mt-3 leading-relaxed text-noir-200">資料經永久刪除後，可能無法恢復或再次提供相關報告與回放服務。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">五、利用對象、地區與處理方式</h2>
        <p className="mt-3 leading-relaxed text-noir-200">資料僅供達成前述目的所必要的人員及服務商處理：</p>
        <ul className="my-4 list-disc space-y-2 pl-6 leading-relaxed text-noir-200"><li>您本人：查閱自己的面試紀錄及分析報告。</li><li>招募企業：僅限您參與之職缺的授權招募人員，於招募目的內查閱獲授權資料，不得存取未授權職缺或其他使用者資料。</li><li>系統管理人員：僅於維運、安全管理及處理權利申請所必要範圍內存取。</li><li>受託技術服務商：依約提供即時對話、分析、儲存或系統維運服務，但不會上傳至雲端作為訓練資料。</li></ul>
        <p className="mt-3 leading-relaxed text-noir-200">依專案設計，即時面試使用 <strong>GPT Realtime</strong>，分析報告使用 <strong>Anthropic Claude API</strong>。</p>
        <p className="mt-3 leading-relaxed text-noir-200">企業端不得直接下載面試影片，企業可線上查閱的報告、逐字稿及影音範圍。個人聯絡資訊預設隱藏，須經您另行同意後，才提供企業解鎖查閱。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">六、自由選擇及不同意的影響</h2>
        <p className="mt-3 leading-relaxed text-noir-200">您可選擇是否使用本次 AI 面試服務，並可在開始前拒絕同意或離開流程。</p>
        <p className="mt-3 leading-relaxed text-noir-200">若您不同意本次面試所必要的資料處理，本系統將無法進行相應的 AI 面試、影音紀錄及分析。</p>
        <p className="mt-3 leading-relaxed text-noir-200">不提供選填資料，或不同意行銷、模型訓練等非必要用途，不應影響基本服務。拒絕使用 AI 面試，也不應直接被視為您的工作能力不足。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">七、當事人權利與申請方式</h2>
        <p className="mt-3 leading-relaxed text-noir-200">您得依適用法令，就個人資料提出查詢或閱覽、製給複製本、補充或更正、停止蒐集、處理或利用，以及刪除等請求。</p>
        <p className="mt-3 leading-relaxed text-noir-200">您可透過帳號設定頁面或第一項所列窗口提出申請。本單位得以必要且相稱的方式確認您的身分，並於適用法定期限內回覆；如依法無法全部辦理，應說明理由及可採取的救濟方式。刪除申請另依第四項所述政策辦理。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">八、撤回同意</h2>
        <p className="mt-3 leading-relaxed text-noir-200">對於以同意為法律依據的處理，您可隨時透過［待確認：與給予同意同樣容易的撤回管道］撤回同意，無須說明理由。</p>
        <p className="mt-3 leading-relaxed text-noir-200">撤回不影響撤回前依有效同意所為處理的合法性。撤回後，本單位應停止以該同意為依據的後續處理；如您同時要求刪除資料，將依第四項及第七項辦理。</p>
        <p className="mt-3 leading-relaxed text-noir-200">若特定資料另有合法保留依據，本單位應告知依據、範圍及期限。撤回後，相關 AI 面試或分析服務可能無法繼續，但不影響您提出權利申請或申訴。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">九、AI 分析、人工審查與模型訓練限制</h2>
        <p className="mt-3 leading-relaxed text-noir-200">本系統依職缺需求及您的回答內容，產生回答品質、溝通表達、專業深度與職位適配度等輔助分析。</p>
        <p className="mt-3 leading-relaxed text-noir-200">AI 結果可能受到口音、背景噪音、網路品質、設備及模型誤差影響，並非絕對準確。評分與建議僅供參考，不得作為錄用或淘汰您的唯一依據，最終決定應由企業人資或主管進行實質人工審查。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本系統不以性別、年齡、外貌、五官、身心障礙或其他與職務無關的條件作為不利評價依據。您可透過第一項窗口提出異議、補充說明，或申請人工複核。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本次同意<strong>不包含將您的面試資料用於 AI 模型訓練或微調</strong>。未來如擬將資料用於模型改善，應先另行說明目的、資料範圍及匿名化方式，並提供獨立、自願的選擇，您可拒絕而不影響原有服務。</p>
        <h2 className="mt-8 mb-3 text-lg font-semibold text-noir-50">十、資料保護及告知內容變更</h2>
        <p className="mt-3 leading-relaxed text-noir-200">本單位應採取與資料風險相稱的傳輸與儲存保護、角色權限控管、必要存取限制及管理操作紀錄，並管理受託服務商的資料處理行為，若發生個人資料事故時，應依適用法令採取補救及通知措施。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本單位不得因取得本次同意，就任意擴大資料用途、接收者或保存期間。若處理範圍有實質變更，應於變更前清楚告知，並於依法需要時重新取得同意，不以單方更新文件視為您已同意。</p>
        <p className="mt-3 leading-relaxed text-noir-200">本同意書不限制您的法定權利，也不免除本單位或招募企業依法應負的責任。</p>

        <form className="mt-8 border-t border-noir-700/50 pt-6" onSubmit={(event) => {
          event.preventDefault();
          if (agreed) onAgree();
        }}>
          <h2 className="mb-4 text-lg font-semibold text-noir-50">同意確認</h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-noir-700/50 p-4 text-sm leading-relaxed text-noir-100">
            <input type="checkbox" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-500" />
            <span className="font-semibold">我已閱讀並理解上述十項告知事項，同意本單位在所載目的、資料類別、保存期間、利用對象及範圍內，蒐集、處理與利用我的資料，包括本次面試的錄音、錄影、逐字稿及 AI 輔助分析。我知悉 AI 結果僅供參考，且可依法行使個人資料權利及撤回同意。本次同意不包含行銷、AI 模型訓練或其他另須獨立授權的用途。</span>
          </label>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="rounded-xl border border-noir-700 px-6 py-3 text-noir-300 transition-colors hover:bg-noir-800">不同意，返回工作台</button>
            <button type="submit" disabled={!agreed} className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-noir-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">同意並開始面試</button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default InterviewConsent;
