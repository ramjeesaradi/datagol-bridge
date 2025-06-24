import { buildReportRow } from '../src/reportBase.js';

describe('buildReportRow', () => {
  test('maps all known fields', () => {
    const job = {
      title: 'Engineer',
      location: 'Paris',
      postedTime: '1 day ago',
      publishedAt: '2024-01-01',
      jobUrl: 'https://example.com',
      companyName: 'Example',
      companyUrl: 'https://example.com/corp',
      description: 'Great job',
      applicationsCount: 5,
      contractType: 'full-time',
      experienceLevel: 'mid',
      workType: 'hybrid',
      sector: 'IT',
      salary: '1000',
      posterFullName: 'John Doe',
      posterProfileUrl: 'https://profile',
      companyId: '123',
      applyUrl: 'https://apply',
      applyType: 'external',
      benefits: 'yes',
    };

    const row = buildReportRow(job);

    expect(row).toEqual({
      position: 0,
      cellValues: {
        title: 'Engineer',
        location: 'Paris',
        postedtime: '1 day ago',
        publishedat: '2024-01-01',
        joburl: 'https://example.com',
        companyname: 'Example',
        companyurl: 'https://example.com/corp',
        description: 'Great job',
        applicationscount: 5,
        contracttype: 'full-time',
        experiencelevel: 'mid',
        worktype: 'hybrid',
        sector: 'IT',
        salary: '1000',
        posterfullname: 'John Doe',
        posterprofileurl: 'https://profile',
        companyid: '123',
        applyurl: 'https://apply',
        applytype: 'external',
        benefits: 'yes',
      },
    });
  });

  test('fills missing properties with empty strings', () => {
    const row = buildReportRow({});
    expect(Object.values(row.cellValues).every(v => v === '')).toBe(true);
  });
});
