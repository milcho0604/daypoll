import { rateKeyIp } from './client-ip';

describe('rateKeyIp', () => {
  it('keeps IPv4 as is', () => {
    expect(rateKeyIp('203.0.113.9')).toBe('203.0.113.9');
  });

  it('unwraps IPv4-mapped IPv6', () => {
    expect(rateKeyIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
  });

  it('groups IPv6 by /64', () => {
    expect(rateKeyIp('2001:db8:1:2::5')).toBe('2001:db8:1:2::/64');
    expect(rateKeyIp('2001:0db8:0001:0002:abcd:1:2:3')).toBe(
      '2001:db8:1:2::/64',
    );
    expect(rateKeyIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
  });

  it('separates different /64 blocks', () => {
    expect(rateKeyIp('2001:db8:1:2::1')).not.toBe(rateKeyIp('2001:db8:1:3::1'));
  });

  it('handles loopback and zone ids', () => {
    expect(rateKeyIp('::1')).toBe('0:0:0:0::/64');
    expect(rateKeyIp('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });
});
