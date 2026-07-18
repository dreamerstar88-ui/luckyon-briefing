// index-futures-quote-scraper
// 야후 파이낸스 quote 페이지(finance.yahoo.com/quote/<symbol>)에서
// 지수 선물 등 현재가·등락률을 읽어 Dataset에 저장한다.
//
// 입력: { tickers: [{ symbol, label }, ...] }  (기본값은 ES=F, NQ=F)
// 출력(Dataset 아이템): { symbol, label, price, changePercent, dir, fetchedAt, source }
//                        실패 시 { symbol, label, error }

import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const tickers = Array.isArray(input.tickers) && input.tickers.length
  ? input.tickers
  : [
      { symbol: 'ES=F', label: 'S&P 500 Fut' },
      { symbol: 'NQ=F', label: 'Nasdaq Fut' },
    ];

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new PlaywrightCrawler({
  proxyConfiguration,
  requestHandlerTimeoutSecs: 60,
  maxRequestRetries: 3,
  maxConcurrency: 2,

  async requestHandler({ page, request, log }) {
    const { symbol, label } = request.userData;
    log.info(`조회 시작: ${symbol}`);

    // 야후는 EU/영국 등 일부 리전에서 쿠키 동의 배너로 콘텐츠를 가림
    try {
      const consentBtn = page.getByRole('button', { name: /accept all|모두 동의/i });
      if (await consentBtn.isVisible({ timeout: 5000 })) {
        await consentBtn.click();
      }
    } catch {
      // 배너가 없으면 무시하고 계속 진행
    }

    // fin-streamer 커스텀 엘리먼트가 페이지 리디자인에 비교적 안정적인 셀렉터
    const priceSel = `fin-streamer[data-symbol="${symbol}"][data-field="regularMarketPrice"]`;
    const changePctSel = `fin-streamer[data-symbol="${symbol}"][data-field="regularMarketChangePercent"]`;

    await page.waitForSelector(priceSel, { timeout: 20000 });

    const priceAttr = await page.locator(priceSel).first().getAttribute('value');
    const changePctAttr = await page.locator(changePctSel).first().getAttribute('value');

    if (!priceAttr) {
      throw new Error(`가격 파싱 실패 (셀렉터를 못 찾음): ${symbol}`);
    }

    const price = Number(priceAttr);
    const changePercent = changePctAttr != null ? Number(changePctAttr) : null;
    const dir = changePercent == null ? 'flat' : changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat';

    await Actor.pushData({
      symbol,
      label,
      price,
      changePercent,
      dir,
      fetchedAt: new Date().toISOString(),
      source: 'yahoo-finance',
    });

    log.info(`성공: ${symbol} = ${price} (${changePercent}%)`);
  },

  async failedRequestHandler({ request, log }, error) {
    const { symbol, label } = request.userData;
    log.error(`실패: ${symbol} — ${error.message}`);
    await Actor.pushData({ symbol, label, error: error.message });
  },
});

await crawler.run(
  tickers.map(({ symbol, label }) => ({
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    userData: { symbol, label },
  })),
);

await Actor.exit();
