import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Req1 from '../pages/Req1HelloWorld';
import Req2 from '../pages/Req2HelloStyles';
import Req3 from '../pages/Req3SeparateUpload';
import Req4 from '../pages/Req4CombinedSeparation';
import Req5 from '../pages/Req5ExtractionParsing';
import Req6 from '../pages/Req6DiscrepancyDetection';
import Req7 from '../pages/Req7TolerantMatching';
import Req8 from '../pages/Req8EvidenceLinked';
import Req9 from '../pages/Req9SubmissionValidation';
import Req10 from '../pages/Req10WorkflowComments';
import NeoCaseFlowPage from './NeoCaseFlowPage';
import { NeoHub } from './NeoHub';
import { NeoLabPage } from './NeoLabPage';
import { NeoPageShell } from './NeoPageShell';
import { NeoRoleProvider } from './NeoRoleContext';
import { NeoRoleSelect } from './NeoRoleSelect';
import { NeoReq11Route } from './NeoReq11Route';
import { NEO_LAB_REQ_META } from './neoLabReqMeta';

function ReqShell({ n, children }: { n: number; children: React.ReactNode }) {
  const meta = NEO_LAB_REQ_META[n];
  return (
    <NeoPageShell title={meta.title} subtitle={meta.subtitle} wide pageContext="lab">
      {children}
    </NeoPageShell>
  );
}

export default function NeoApp() {
  return (
    <NeoRoleProvider>
      <div className="neo-app">
        <Routes>
          <Route path="/" element={<NeoRoleSelect />} />
          <Route path="/hub" element={<NeoHub />} />
          <Route path="/lab" element={<NeoLabPage />} />
          <Route path="/caseflow" element={<NeoCaseFlowPage />} />

          <Route
            path="/req/1"
            element={
              <ReqShell n={1}>
                <Req1 />
              </ReqShell>
            }
          />
          <Route
            path="/req/2"
            element={
              <ReqShell n={2}>
                <Req2 />
              </ReqShell>
            }
          />
          <Route
            path="/req/3"
            element={
              <ReqShell n={3}>
                <Req3 />
              </ReqShell>
            }
          />
          <Route
            path="/req/4"
            element={
              <ReqShell n={4}>
                <Req4 />
              </ReqShell>
            }
          />
          <Route
            path="/req/5"
            element={
              <ReqShell n={5}>
                <Req5 />
              </ReqShell>
            }
          />
          <Route
            path="/req/6"
            element={
              <ReqShell n={6}>
                <Req6 />
              </ReqShell>
            }
          />
          <Route
            path="/req/7"
            element={
              <ReqShell n={7}>
                <Req7 />
              </ReqShell>
            }
          />
          <Route
            path="/req/8"
            element={
              <ReqShell n={8}>
                <Req8 />
              </ReqShell>
            }
          />
          <Route
            path="/req/9"
            element={
              <ReqShell n={9}>
                <Req9 />
              </ReqShell>
            }
          />
          <Route
            path="/req/10"
            element={
              <ReqShell n={10}>
                <Req10 />
              </ReqShell>
            }
          />
          <Route
            path="/req/11"
            element={
              <ReqShell n={11}>
                <NeoReq11Route />
              </ReqShell>
            }
          />

          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
      </div>
    </NeoRoleProvider>
  );
}
