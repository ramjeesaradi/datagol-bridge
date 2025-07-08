export function buildReportRow(job, position) {
    return {
        position: position,
        cellValues: {
            title: job.title ?? '',
            location: job.location ?? '',
            postedtime: job.postedTime ?? '',
            publishedat: job.publishedAt ?? '',
            joburl: job.jobUrl ?? '',
            companyname: job.companyName ?? '',
            companyurl: job.companyUrl ?? '',
            description: job.description ?? '',
            applicationscount: job.applicationsCount ?? '',
            contracttype: job.contractType ?? '',
            experiencelevel: job.experienceLevel ?? '',
            worktype: job.workType ?? '',
            sector: job.sector ?? '',
            salary: job.salary ?? '',
            posterfullname: job.posterFullName ?? '',
            posterprofileurl: job.posterProfileUrl ?? '',
            companyid: job.companyId ?? '',
            applyurl: job.applyUrl ?? '',
            applytype: job.applyType ?? '',
            benefits: job.benefits ?? '',
        },
    };
}
