package servlet;

import java.io.IOException;
import java.util.ArrayList;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import dao.MovieDAO;
import model.Member;
import model.Review;

@WebServlet("/myreviewpage.do")
public class MyReviewPageServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		myReview(request, response);
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		myReview(request, response);
	}

	protected void myReview(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		MovieDAO dao = new MovieDAO();
		HttpSession session = request.getSession();
		Member nowUser = (Member) session.getAttribute("member");
		int memseq = nowUser.getMember_seq();
		ArrayList<Review> reviewList = dao.getMyReviewAll(memseq);
		request.setAttribute("reviewList", reviewList );

		RequestDispatcher dis = request.getRequestDispatcher("myreviewpage.jsp");
		dis.forward(request, response);
	}
}