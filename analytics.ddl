DROP TABLE pdexanalytics.trades;
DROP TABLE pdexanalytics.exchange_alltime;
DROP TABLE pdexanalytics.exchange_hourly;
DROP TABLE pdexanalytics.exchange_24h;
DROP TABLE pdexanalytics.markets_24h;
DROP TABLE pdexanalytics.assets_24h;
DROP TABLE pdexanalytics.exchange_daily;
DROP TABLE pdexanalytics.markets_daily;
DROP TABLE pdexanalytics.assets_daily;
DROP TABLE pdexanalytics.assets_hourly;
DROP TABLE pdexanalytics.markets;
DROP TABLE pdexanalytics.assets;

CREATE TABLE pdexanalytics.assets
(
  asset_id varchar(64) not null,
  symbol varchar(60) not null,
  name varchar(60) not null,
  price decimal(20,10),
  tvl decimal(12,2),
  balance decimal(16,4)
  is_active bit not null,
  PRIMARY KEY (asset_id)
);

ALTER TABLE assets ADD INDEX symbol_index (symbol);

CREATE TABLE pdexanalytics.markets
(
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  is_active bit not null,
  PRIMARY KEY (base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

CREATE TABLE pdexanalytics.trades
(
  trade_id bigint not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  price decimal(20,10) not null,
  quantity decimal(20,10) not null,
  volume decimal(12,2),
  timestamp datetime not null,
  PRIMARY KEY (trade_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

ALTER TABLE trades ADD INDEX timestamp_index (timestamp);
ALTER TABLE trades add INDEX market_index (base_asset_id, quote_asset_id);

CREATE TABLE pdexanalytics.exchange_daily
(
  stat_date date not null,
  tvl decimal(12,2),
  volume decimal(12,2),
  users int,
  trades int,
  total_staked int,
  staked_tvl decimal(12,2),
  total_holders int,
  total_stakers int,
  PRIMARY KEY (stat_date)
);

CREATE TABLE pdexanalytics.markets_hourly
(
  stat_time timestamp not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  price decimal(20,10) null,
  PRIMARY KEY (stat_time, base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);
ALTER TABLE markets_hourly ADD INDEX market_pair_index (base_asset_id, quote_asset_id);

CREATE TABLE pdexanalytics.markets_daily
(
  stat_date date not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  volume decimal(12,2),
  trades int,
  PRIMARY KEY (stat_date, base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

ALTER TABLE markets_daily ADD INDEX market_pair_index (base_asset_id, quote_asset_id);

CREATE TABLE pdexanalytics.assets_daily
(
  stat_date date not null,
  asset_id varchar(64) not null,
  tvl decimal(12,2),
  price decimal(20,10) not null,
  volume decimal(12,2),
  trades int,
  balance decimal(16,4)
  PRIMARY KEY (stat_date, asset_id)
);

ALTER TABLE assets_daily ADD INDEX asset_index (asset_id);

CREATE TABLE pdexanalytics.assets_hourly
(
  stat_time timestamp not null,
  asset_id varchar(64) not null,
  tvl decimal(12,2),
  price decimal(20,10) not null,
  balance decimal(16,4),
  PRIMARY KEY (stat_time, asset_id)
);

ALTER TABLE assets_hourly ADD INDEX asset_index (asset_id);

CREATE TABLE pdexanalytics.exchange_hourly
(
  stat_time timestamp not null,
  tvl decimal(12,2),
  volume decimal(12,2),
  users int,
  trades int,
  total_staked int default null,
  staked_tvl decimal(12,2) default null,
  total_holders int default null,
  total_stakers int default null,
  PRIMARY KEY (stat_time)
);

CREATE TABLE pdexanalytics.exchange_24h
(
  tvl decimal(12,2),
  volume decimal(12,2),
  users int,
  trades int,
  total_staked int default null,
  staked_tvl decimal(12,2) default null,
  total_holders int default null,
  total_stakers int default null,
  previous_tvl decimal(12,2),
  previous_volume decimal(12,2),
  previous_users int,
  previous_trades int,
  previous_total_staked int default null,
  previous_staked_tvl decimal(12,2) default null,
  previous_total_holders int default null,
  previous_total_stakers int default null
);

INSERT INTO pdexanalytics.exchange_24h () VALUES();

CREATE TABLE pdexanalytics.assets_24h
(
  asset_id varchar(64) not null,
  tvl decimal(12,2),
  price decimal(20,10) not null,
  balance decimal(16,4) default null,
  volume decimal(12,2),
  trades int,
  previous_tvl decimal(12,2),
  previous_price decimal(20,10) not null,
  previous_balance decimal(16,4) default null,
  previous_volume decimal(12,2),
  previous_trades int,
  PRIMARY KEY (asset_id)
);


CREATE TABLE pdexanalytics.markets_24h
(
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  volume decimal(12,2),
  trades int,
  previous_volume decimal(12,2),
  previous_trades int,
  PRIMARY KEY (base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

alter table exchange_daily add treasury_balance int null;
alter table exchange_daily add treasury_tvl decimal(12,2) null;
alter table exchange_hourly add treasury_balance int null;
alter table exchange_hourly add treasury_tvl decimal(12,2) null;
alter table exchange_24h add treasury_balance int null;
alter table exchange_24h add treasury_tvl decimal(12,2) null;
alter table exchange_24h add previous_treasury_balance int null;
alter table exchange_24h add previous_treasury_tvl decimal(12,2) null;


alter table exchange_daily add total_issuance int null;
alter table exchange_hourly add total_issuance int null;
alter table exchange_24h add total_issuance int null;
alter table exchange_24h add previous_total_issuance int null;

alter table trades modify column volume decimal(18,6);
alter table exchange_daily modify column volume decimal(18,6);
alter table markets_daily modify column volume decimal(18,6);
alter table assets_daily modify column volume decimal(18,6);
alter table exchange_hourly modify column volume decimal(18,6);
alter table exchange_24h modify column volume decimal(18,6);
alter table assets_24h modify column volume decimal(18,6);
alter table markets_24h modify column volume decimal(18,6);
alter table exchange_24h modify column previous_volume decimal(18,6);
alter table assets_24h modify column previous_volume decimal(18,6);
alter table markets_24h modify column previous_volume decimal(18,6);

alter table trades add column m_id varchar(100);
alter table trades add column t_id varchar(100);
alter table trades add column m_cid varchar(100);
alter table trades add column t_cid varchar(100);
alter table trades add column m_side varchar(6);
alter table trades add column t_side varchar(6);
alter table trades add column trade_oid varchar(100);

alter table exchange_daily add new_users int null;
alter table exchange_hourly add new_users int null;
alter table exchange_24h add new_users int null;
alter table exchange_24h add previous_new_users int null;

alter table assets add fees decimal(18,9) null;
alter table assets add fees_value decimal(12,2) null;

alter table assets_daily add fees decimal(18,9) null;
alter table assets_hourly add fees decimal(18,9) null;
alter table assets_24h add fees decimal(18,9) null;
alter table assets_24h add previous_fees decimal(18,9) null;

alter table assets_daily add fees_value decimal(12,2) null;
alter table assets_hourly add fees_value decimal(12,2) null;
alter table assets_24h add fees_value decimal(12,2) null;
alter table assets_24h add previous_fees_value decimal(12,2) null;

alter table exchange_daily add total_fees decimal(12,2) null;
alter table exchange_hourly add total_fees decimal(12,2) null;
alter table exchange_24h add total_fees decimal(12,2) null;
alter table exchange_24h add previous_total_fees decimal(12,2) null;

alter table assets add new_fees decimal(18,9) null;
alter table assets add new_fees_value decimal(12,2) null;

alter table assets_daily add new_fees decimal(18,9) null;
alter table assets_hourly add new_fees decimal(18,9) null;
alter table assets_24h add new_fees decimal(18,9) null;
alter table assets_24h add previous_new_fees decimal(18,9) null;

alter table assets_daily add new_fees_value decimal(12,2) null;
alter table assets_hourly add new_fees_value decimal(12,2) null;
alter table assets_24h add new_fees_value decimal(12,2) null;
alter table assets_24h add previous_new_fees_value decimal(12,2) null;

alter table exchange_daily add total_fees decimal(12,2) null;
alter table exchange_hourly add total_fees decimal(12,2) null;
alter table exchange_24h add total_fees decimal(12,2) null;
alter table exchange_24h add previous_total_fees decimal(12,2) null;

alter table exchange_daily add new_total_fees decimal(12,2) null;
alter table exchange_hourly add new_total_fees decimal(12,2) null;
alter table exchange_24h add new_total_fees decimal(12,2) null;
alter table exchange_24h add previous_new_total_fees decimal(12,2) null;

CREATE TABLE pdexanalytics.exchange_alltime
(
  volume decimal(18,2),
  trades int,
  total_fees decimal(18,2)
);
insert into exchange_alltime (volume, trades, total_fees) values (0,0,0);

alter table trades add volume_quote decimal(20,10) null;
alter table markets_daily add column volume_quote decimal(20,10) null;
alter table markets_24h add column volume_quote decimal(20,10) null;
alter table markets_24h add column previous_volume_quote decimal(20,10) null;

alter table markets_daily add column volume_base decimal(20,10) null;
alter table markets_24h add column volume_base decimal(20,10) null;
alter table markets_24h add column previous_volume_base decimal(20,10) null;

alter table pdexanalytics.markets add price decimal(20,10) null;
alter table pdexanalytics.markets_24h add price_high decimal(20,10) null;
alter table pdexanalytics.markets_24h add price_low decimal(20,10) null;
alter table pdexanalytics.markets_24h add price_24h decimal(20,10) null;

CREATE TABLE pdexanalytics.orderbook_lastupdate
(
    last_update timestamp
);

INSERT INTO pdexanalytics.orderbook_lastupdate () VALUES();

CREATE TABLE pdexanalytics.orderbook
(
  stid varchar(100) not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  price decimal(20,10) not null,
  quantity decimal(20,10) not null,
  side varchar(6) not null,
  primary key(stid)
);

ALTER TABLE orderbook add INDEX full_orderbook_index (base_asset_id, quote_asset_id);
ALTER TABLE orderbook add INDEX orderbook_side_index (base_asset_id, quote_asset_id, side);
