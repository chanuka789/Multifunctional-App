import { SitePage } from '@/components/Site';

export function Privacy() {
  return (
    <SitePage title="Privacy">
      <article className="page">
        <h1 className="page-title">Privacy</h1>
        <aside className="page-aside">
          <p className="lead m-0">Your files are processed on your own device. We never see them unless you choose to share one.</p>
        </aside>
        <div className="page-body">
          <h2>What happens to your files</h2>
          <p>Every tool opens your file inside your browser tab and uses your own processor to do the work. The file is not sent to Ondevo or anyone else. Closing the tab removes it from memory.</p>
          <h2>Share links</h2>
          <p>
            When you press <strong>Get a share link</strong>, your browser uploads that one result straight to our storage bucket. Anyone with the link can download it. It is deleted automatically 2 hours after upload; you can delete it sooner from your account.
          </p>
          <h2>Engines and language data</h2>
          <p>The first time you use some tools, your browser downloads open-source engines and data (for example the OCR language files or the speech model) from public mirrors such as jsDelivr and Hugging Face. Those services see a normal download request from your browser, not your files.</p>
          <h2>Accounts</h2>
          <p>An account stores your email address, your optional name, a securely hashed password (Argon2id), your saved settings and the list of your live share links. A session cookie keeps you logged in. Deleting your account removes all of this at once.</p>
          <h2>Cookies and tracking</h2>
          <p>We use one cookie for logged-in sessions. There are no advertising or analytics cookies. Your theme choice is kept in your browser's local storage.</p>
          <h2>Contact</h2>
          <p>Questions about privacy: write to the address listed by the site operator.</p>
        </div>
      </article>
    </SitePage>
  );
}

export function Terms() {
  return (
    <SitePage title="Terms">
      <article className="page">
        <h1 className="page-title">Terms of use</h1>
        <aside className="page-aside">
          <p className="lead m-0">Use the tools for your own files and files you have the right to use.</p>
        </aside>
        <div className="page-body">
          <h2>The service</h2>
          <p>Ondevo gives you tools that run in your browser. Results depend on your device and the quality of your files. Check important results, such as OCR text, before you rely on them.</p>
          <h2>Shared files</h2>
          <p>You are responsible for what you share. Do not share files that are illegal, that you have no right to share, or that contain malware. Shared files are deleted after 2 hours and may be removed sooner if they break these terms.</p>
          <h2>Open-source parts</h2>
          <p>Ondevo is built on open-source software including RNNoise, SoundTouch, Tesseract, Whisper (through Transformers.js), pdf.js, pdf-lib and ffmpeg.wasm. Each keeps its own licence.</p>
          <h2>No warranty</h2>
          <p>The tools are provided as they are, without warranty. To the extent the law allows, Ondevo is not liable for lost data or results.</p>
        </div>
      </article>
    </SitePage>
  );
}
