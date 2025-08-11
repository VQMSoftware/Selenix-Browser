import * as React from 'react';
import styled from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  line-height: 1.6;
`;

const Banner = styled.img`
  width: 360px;
  height: auto;
  align-self: center;
`;

const Versions = styled.div`
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
`;

export const About: React.FC = () => {
  const versions = (process as any).versions || {};
  return (
    <Wrapper>
      <Banner src={require('./selenix-banner.png')} alt="Selenix" />
      <div>
        <p>
          The Wexond team discontinued and later sold their project some time ago. I have always admired their work, and this repository is an effort to build upon it while staying within legal and licensing requirements. Specifically, this project is based on a commit tagged <strong>v5.2.0</strong> in the original repository, which included the GPL license file. That version can be found <a href="https://github.com/wexond/browser-base/tree/v5.2.0" target="_blank" rel="noreferrer">here</a>.
        </p>
        <p>
          As developers, many of us have attempted to compile Chromium from source, only to find the process extremely time-consuming and resource-intensive. <strong>Selenix</strong> aims to address that challenge by leveraging the foundation provided by Wexond’s project, now updated to support modern Node.js and Electron versions.
        </p>
      </div>
      <Versions>
        <div>Electron: {versions.electron || '—'}</div>
        <div>Chromium: {versions.chrome || '—'}</div>
        <div>Node.js: {versions.node || '—'}</div>
        <div>V8: {versions.v8 || '—'}</div>
      </Versions>
    </Wrapper>
  );
};
