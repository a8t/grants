import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
	q?: string;
	applicant?: string;
	status?: string;
};

const selectClass =
	'h-10 rounded-base border-2 border-border bg-secondary-background px-3 text-sm font-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black';

export function GrantSearchForm({ q = '', applicant = 'all', status = 'all' }: Props) {
	return (
		<form method="get" action="/grants" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
			<label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
				<span className="font-heading text-sm">Search</span>
				<Input
					type="search"
					name="q"
					defaultValue={q}
					placeholder="Name, funder, discipline…"
					aria-label="Search grants"
				/>
			</label>
			<label className="flex w-full flex-col gap-1.5 md:w-44">
				<span className="font-heading text-sm">Applicant</span>
				<select name="applicant" defaultValue={applicant} className={selectClass}>
					<option value="all">Anyone</option>
					<option value="individual">Individuals</option>
					<option value="organization">Organizations</option>
				</select>
			</label>
			<label className="flex w-full flex-col gap-1.5 md:w-44">
				<span className="font-heading text-sm">Status</span>
				<select name="status" defaultValue={status} className={selectClass}>
					<option value="all">Open + rolling</option>
					<option value="open">Open deadline</option>
					<option value="rolling">Rolling</option>
				</select>
			</label>
			<input type="hidden" name="province" value="ON" />
			<Button type="submit" size="lg" className="md:mb-0">
				Find grants
			</Button>
		</form>
	);
}
