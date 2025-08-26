import { useInterval } from '@mantine/hooks';
import { isTauri } from '@tauri-apps/api/core';
import * as tauriPath from '@tauri-apps/api/path';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor } from '@tauri-apps/api/window';
import * as fs from '@tauri-apps/plugin-fs';
import * as os from '@tauri-apps/plugin-os';
import React, { PropsWithChildren, useContext, useEffect, useState } from 'react';
import tauriConfJson from '../../src-tauri/tauri.conf.json';

const WIN32_CUSTOM_TITLEBAR = false;
export const APP_NAME = tauriConfJson.productName;
export const IS_MOBILE = navigator.maxTouchPoints > 0;

const EXTS = new Set(['.json']);

interface SystemProvideContext {
    loading: boolean;
    downloads?: string;
    documents?: string;
    appDocuments?: string;
    osType?: os.OsType;
    fileSep: string;
    isFullScreen: boolean;
    usingCustomTitleBar: boolean;
    scaleFactor: number;
}

const TauriContext = React.createContext<SystemProvideContext>({
    loading: true,
    fileSep: '/',
    isFullScreen: false,
    usingCustomTitleBar: false,
    scaleFactor: 1
});

export const useTauriContext = () => useContext(TauriContext);

export function TauriProvider({ children }: PropsWithChildren) {
    const [loading, setLoading] = useState(true);
    const [downloads, setDownloadDir] = useState<string>();
    const [documents, setDocumentDir] = useState<string>();
    const [osType, setOsType] = useState<os.OsType>();
    const [fileSep, setFileSep] = useState('/');
    const [appDocuments, setAppDocuments] = useState<string>();
    const [isFullScreen, setFullscreen] = useState(false);
    const [usingCustomTitleBar, setUsingCustomTitleBar] = useState(false);
    const [scaleFactor, setScaleFactor] = useState(1);

    const appWindow = getCurrentWebviewWindow();
    const tauriInterval = useInterval(async () => {
        if (!isTauri()) return;

        setFullscreen(await appWindow.isFullscreen());

        const monitor = await currentMonitor();
        if (monitor) {
            const monitorSF = monitor.scaleFactor;
            setScaleFactor(monitorSF);
        }
    }, 200);

    // Start/stop interval när komponent mountas/unmountas
    useEffect(() => {
        if (!isTauri()) return;
        tauriInterval.start();
        return tauriInterval.stop;
    }, []);

    // Windows-specifika inställningar
    useEffect(() => {
        if (!isTauri() || osType !== 'windows') return;
        setUsingCustomTitleBar(WIN32_CUSTOM_TITLEBAR);
    }, [osType]);

    // Hämta OS-typ och kataloger
    useEffect(() => {
        if (!isTauri()) {
            setLoading(false);
            return;
        }
        (async () => {
            const type = await os.type();
            setOsType(type);

            const sep = await tauriPath.separator();
            setFileSep(sep);

            const downloadsDir = await tauriPath.downloadDir();
            setDownloadDir(downloadsDir);

            const documentsDir = await tauriPath.documentDir();
            setDocumentDir(documentsDir);

            const appDocDir = await tauriPath.appDataDir();
            setAppDocuments(appDocDir);

            setLoading(false);
        })();
    }, []);

    return (
        <TauriContext.Provider
            value={{
                loading,
                downloads,
                documents,
                appDocuments,
                osType,
                fileSep,
                isFullScreen,
                usingCustomTitleBar,
                scaleFactor
            }}
        >
            {children}
        </TauriContext.Provider>
    );
}