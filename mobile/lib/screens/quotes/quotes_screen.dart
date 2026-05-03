import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/app_provider.dart';
import '../../config/theme.dart';
import '../projects/projects_screen.dart';

class QuotesScreen extends StatelessWidget {
  const QuotesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final prov = context.watch<ProjectProvider>();

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => prov.loadQuotes(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            Row(
              children: [
                Text('Wyceny', style: Theme.of(context).textTheme.headlineSmall),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: colors.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text('${prov.quotes.length}', style: TextStyle(color: colors.warning, fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (prov.quotes.isEmpty)
              Center(
                child: Column(
                  children: [
                    const SizedBox(height: 80),
                    Icon(Icons.receipt_long_outlined, size: 48, color: const Color(0xFFB2BEC3).withOpacity(0.5)),
                    const SizedBox(height: 12),
                    Text('Brak wycen', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFFB2BEC3))),
                  ],
                ),
              )
            else
              ...prov.quotes.asMap().entries.map((e) {
                final q = e.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFFFFF9E6), Color(0xFFFFFDF5)]),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: colors.warning.withOpacity(0.2)),
                  ),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: q))),
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 44, height: 44,
                                  decoration: BoxDecoration(color: colors.warning.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
                                  child: Icon(Icons.description_rounded, color: colors.warning, size: 22),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(q.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF2D3436)), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 2),
                                      Text(q.clientName, style: const TextStyle(fontSize: 12, color: Color(0xFF636E72))),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (q.pricing != null) ...[
                              const SizedBox(height: 14),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(color: colors.warning.withOpacity(0.08), borderRadius: BorderRadius.circular(12)),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Wartość', style: TextStyle(fontSize: 13, color: Color(0xFF636E72))),
                                    Text('${NumberFormat('#,##0', 'pl').format(q.pricing!.total)} PLN', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF2D3436))),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
